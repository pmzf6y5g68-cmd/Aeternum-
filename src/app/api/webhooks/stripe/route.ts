import type Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { notifyClientLatePaymentRefunded, sendBookingConfirmation } from "@/lib/email/booking-emails";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { rewardReferralOnFirstPayment } from "@/lib/referral";
import { confirmGuarantee } from "@/lib/guarantee";
import { activateGiftCard } from "@/lib/gift-cards";
import { activateClientPack } from "@/lib/packs";
import { getStripe } from "@/lib/stripe";
import { notifyPaymentFailed, notifyTrialEnding } from "@/lib/email/pro-emails";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Business } from "@/lib/supabase/types";

/**
 * Un seul endpoint pour les deux sources Stripe :
 * - "Your account" (abonnements Pro)          -> STRIPE_WEBHOOK_SECRET
 * - "Connected accounts" (acomptes, comptes)  -> STRIPE_CONNECT_WEBHOOK_SECRET
 */
function verify(payload: string, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  for (const secret of [env.stripeWebhookSecret(), env.stripeConnectWebhookSecret()]) {
    if (!secret) continue;
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      // Essai du secret suivant.
    }
  }
  return null;
}

const PRO_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const plan = PRO_STATUSES.includes(subscription.status) ? "pro" : "free";
  const businessId = subscription.metadata?.business_id;

  const query = admin.from("businesses").update({ plan, stripe_subscription_id: plan === "pro" ? subscription.id : null, stripe_customer_id: customerId });
  const { error } = businessId ? await query.eq("id", businessId) : await query.eq("stripe_customer_id", customerId);
  if (error) throw new Error(error.message);
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (!session.subscription) return;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  if (!subscription.metadata?.business_id && session.metadata?.business_id) {
    subscription.metadata = { ...subscription.metadata, business_id: session.metadata.business_id };
  }
  await syncSubscription(subscription);
}

async function confirmDeposit(session: Stripe.Checkout.Session, connectedAccount: string | undefined): Promise<void> {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId || session.payment_status !== "paid") return;

  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle<Booking>();
  if (!booking || booking.deposit_paid) return; // Idempotence : déjà traité.

  const { data: business } = await admin.from("businesses").select("*").eq("id", booking.business_id).single<Business>();
  if (!business) return;
  if (connectedAccount && business.stripe_connect_account_id !== connectedAccount) {
    await logEvent("stripe.webhook", "account mismatch on deposit", { booking_id: bookingId, connectedAccount });
    return;
  }

  let confirmed = false;
  if (booking.status === "pending_deposit") {
    const { data } = await admin
      .from("bookings")
      .update({ status: "scheduled", deposit_paid: true, stripe_checkout_session_id: session.id, cancelled_by: null })
      .eq("id", booking.id)
      .eq("status", "pending_deposit")
      .select("id");
    confirmed = (data ?? []).length > 0;
  }
  if (!confirmed && booking.status === "cancelled") {
    // Paiement arrivé après la libération du créneau : on le réactive s'il est toujours libre.
    const { data } = await admin.rpc("reactivate_paid_booking", {
      p_booking_id: booking.id,
      p_pending_ttl_minutes: siteConfig.booking.pendingDepositTtlMinutes,
    });
    confirmed = data === true;
    if (!confirmed) {
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (paymentIntent && business.stripe_connect_account_id) {
        await getStripe().refunds.create({ payment_intent: paymentIntent }, { stripeAccount: business.stripe_connect_account_id });
      }
      await admin.from("bookings").update({ stripe_checkout_session_id: session.id }).eq("id", booking.id);
      await notifyClientLatePaymentRefunded(booking, business);
      await logEvent("stripe.webhook", "late deposit refunded: slot taken", { booking_id: booking.id }, "warning");
      return;
    }
  }
  if (!confirmed) return;

  const fresh = { ...booking, status: "scheduled" as const, deposit_paid: true };
  const [{ data: addons }, { data: staff }] = await Promise.all([
    booking.addon_ids.length
      ? admin.from("addons").select("name").in("id", booking.addon_ids).returns<{ name: string }[]>()
      : Promise.resolve({ data: [] as { name: string }[] }),
    booking.staff_id ? admin.from("staff").select("name").eq("id", booking.staff_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
  ]);
  await sendBookingConfirmation(fresh, business, (addons ?? []).map((a) => a.name), staff?.name ?? null);
}

/** Apple Pay / Google Pay sur notre domaine : le domaine doit être enregistré sur chaque compte connecté. */
async function registerWalletDomain(accountId: string): Promise<void> {
  const domain = (process.env.APP_DOMAIN ?? "").replace(/^https?:\/\//, "");
  if (!domain) return;
  try {
    await getStripe().paymentMethodDomains.create({ domain_name: domain }, { stripeAccount: accountId });
  } catch (err) {
    // Déjà enregistré : sans conséquence.
    if (!/already/i.test(errorMessage(err))) await logEvent("stripe.walletDomain", errorMessage(err), { accountId }, "warning");
  }
}

async function syncConnectAccount(account: Stripe.Account): Promise<void> {
  const onboarded = Boolean(account.charges_enabled && account.details_submitted);
  if (onboarded) await registerWalletDomain(account.id);
  const patch: Record<string, unknown> = { stripe_connect_onboarded: onboarded };
  if (!onboarded) patch.deposit_enabled = false;
  const { error } = await createAdminClient().from("businesses").update(patch).eq("stripe_connect_account_id", account.id);
  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonError("missing_signature", 400);
  const payload = await request.text();
  const event = verify(payload, signature);
  if (!event) return jsonError("invalid_signature", 400);

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.mode === "subscription") await handleSubscriptionCheckout(session);
        else if (session.mode === "setup") await confirmGuarantee(session, event.account);
        else if (session.mode === "payment" && session.metadata?.gift_card_id) await activateGiftCard(session, event.account);
        else if (session.mode === "payment" && session.metadata?.client_pack_id) await activateClientPack(session, event.account);
        else if (session.mode === "payment") await confirmDeposit(session, event.account);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.paid": {
        const invoice = event.data.object;
        const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customer && invoice.amount_paid > 0 && !event.account) await rewardReferralOnFirstPayment(customer);
        break;
      }
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object;
        const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        if (!event.account) await notifyTrialEnding(customer, sub.trial_end ?? null);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customer && !event.account) await notifyPaymentFailed(customer, invoice.attempt_count ?? 1, invoice.next_payment_attempt ?? null);
        break;
      }
      case "account.updated":
        await syncConnectAccount(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    await logEvent("stripe.webhook", errorMessage(err), { type: event.type, id: event.id });
    return jsonError("handler_error", 500);
  }
  return json({ received: true });
}
