import "server-only";
import type Stripe from "stripe";
import { formatEur, eurToCents } from "@/lib/domain/pricing";
import { formatDateTime, sendBookingConfirmation } from "@/lib/email/booking-emails";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { errorMessage, logEvent } from "@/lib/events";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Business } from "@/lib/supabase/types";

/** Email de confirmation avec noms des options et du membre d'équipe. */
export async function sendConfirmationFor(booking: Booking, business: Business): Promise<void> {
  const admin = createAdminClient();
  const [{ data: addons }, { data: staff }] = await Promise.all([
    booking.addon_ids.length ? admin.from("addons").select("name").in("id", booking.addon_ids).returns<{ name: string }[]>() : Promise.resolve({ data: [] as { name: string }[] }),
    booking.staff_id ? admin.from("staff").select("name").eq("id", booking.staff_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
  ]);
  await sendBookingConfirmation(booking, business, (addons ?? []).map((a) => a.name), staff?.name ?? null);
}

/** Checkout « setup » terminé : carte enregistrée, le rendez-vous est confirmé. */
export async function confirmGuarantee(session: Stripe.Checkout.Session, connectedAccount: string | undefined): Promise<void> {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId || session.status !== "complete" || !connectedAccount) return;
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle<Booking>();
  if (!booking || booking.guarantee_status === "saved") return;
  const { data: business } = await admin.from("businesses").select("*").eq("id", booking.business_id).single<Business>();
  if (!business || business.stripe_connect_account_id !== connectedAccount) {
    await logEvent("stripe.guarantee", "account mismatch", { booking_id: bookingId, connectedAccount });
    return;
  }
  const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  if (!setupIntentId) return;
  const intent = await getStripe().setupIntents.retrieve(setupIntentId, {}, { stripeAccount: connectedAccount });
  const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  if (!paymentMethod) return;

  const { data: updated } = await admin
    .from("bookings")
    .update({ status: "scheduled", guarantee_status: "saved", stripe_payment_method_id: paymentMethod, stripe_checkout_session_id: session.id })
    .eq("id", booking.id)
    .eq("status", "pending_deposit")
    .select("*")
    .returns<Booking[]>();
  const fresh = updated?.[0];
  if (!fresh) {
    // Créneau déjà libéré : aucune somme n'a été prélevée, on retire simplement la carte.
    await getStripe().paymentMethods.detach(paymentMethod, {}, { stripeAccount: connectedAccount }).catch(() => undefined);
    await logEvent("stripe.guarantee", "card saved after slot release: detached", { booking_id: booking.id }, "warning");
    return;
  }
  await sendConfirmationFor(fresh, business);
}

/**
 * Absence constatée par le pro : prélève les frais annoncés, hors session, sur la carte enregistrée.
 * Réservation atomique de l'état (saved -> charged) pour ne jamais débiter deux fois.
 */
export async function chargeNoShowFee(bookingId: string): Promise<"charged" | "failed" | "skipped"> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("bookings")
    .update({ guarantee_status: "charged" })
    .eq("id", bookingId)
    .eq("guarantee_status", "saved")
    .eq("status", "no_show")
    .select("*")
    .returns<Booking[]>();
  const booking = claimed?.[0];
  if (!booking || !booking.stripe_customer_id || !booking.stripe_payment_method_id) return "skipped";
  const amount = eurToCents(booking.no_show_fee_eur);
  const { data: business } = await admin.from("businesses").select("*").eq("id", booking.business_id).single<Business>();
  if (!business?.stripe_connect_account_id || amount < 100) {
    await admin.from("bookings").update({ guarantee_status: "saved" }).eq("id", booking.id);
    return "skipped";
  }
  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount,
        currency: "eur",
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Frais d'absence — ${business.name}, ${formatDateTime(booking.start_at)}`,
        metadata: { booking_id: booking.id, business_id: business.id, kind: "no_show_fee" },
      },
      { stripeAccount: business.stripe_connect_account_id, idempotencyKey: `no-show-${booking.id}` },
    );
    await admin.from("bookings").update({ stripe_fee_payment_intent_id: intent.id }).eq("id", booking.id);
    await sendEmail({
      to: booking.client_email,
      subject: `Frais d'absence — ${business.name}`,
      text: `Bonjour ${booking.client_name},\n\nVous n'êtes pas venu(e) à votre rendez-vous du ${formatDateTime(booking.start_at)} chez ${business.name}, sans l'avoir annulé. Comme indiqué lors de la réservation, ${formatEur(amount)} ont été prélevés sur la carte enregistrée.\n\nEn cas d'erreur, répondez à cet email ou contactez directement ${business.name}.`,
      html: layoutHtml(`Frais d'absence — ${business.name}`, [
        `Bonjour ${booking.client_name},`,
        `Vous n'êtes pas venu(e) à votre rendez-vous du ${formatDateTime(booking.start_at)} chez ${business.name}, sans l'avoir annulé.`,
        `Comme indiqué lors de la réservation, ${formatEur(amount)} ont été prélevés sur la carte enregistrée.`,
        `En cas d'erreur, répondez à cet email ou contactez directement ${business.name}.`,
      ]),
      replyTo: business.email,
    });
    return "charged";
  } catch (err) {
    await admin.from("bookings").update({ guarantee_status: "failed" }).eq("id", booking.id);
    await logEvent("stripe.noShowFee", errorMessage(err), { booking_id: booking.id }, "warning");
    return "failed";
  }
}

/** Le pro corrige une absence signalée par erreur : remboursement intégral des frais. */
export async function refundNoShowFee(bookingId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("bookings")
    .update({ guarantee_status: "refunded" })
    .eq("id", bookingId)
    .eq("guarantee_status", "charged")
    .neq("status", "no_show")
    .select("id, business_id, stripe_fee_payment_intent_id")
    .returns<Pick<Booking, "id" | "business_id" | "stripe_fee_payment_intent_id">[]>();
  const booking = claimed?.[0];
  if (!booking?.stripe_fee_payment_intent_id) return;
  const { data: business } = await admin.from("businesses").select("stripe_connect_account_id").eq("id", booking.business_id).single<{ stripe_connect_account_id: string | null }>();
  if (!business?.stripe_connect_account_id) return;
  try {
    await getStripe().refunds.create({ payment_intent: booking.stripe_fee_payment_intent_id }, { stripeAccount: business.stripe_connect_account_id, idempotencyKey: `no-show-refund-${booking.id}` });
  } catch (err) {
    await logEvent("stripe.noShowRefund", errorMessage(err), { booking_id: booking.id });
  }
}
