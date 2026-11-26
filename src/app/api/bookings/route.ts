import { rateLimit } from "@/lib/rate-limit";
import { alertQuotaBlocked } from "@/lib/email/pro-emails";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { BookingInputError, locationSchema, resolveSelection } from "@/lib/booking-request";
import { rankStaffByLoad } from "@/lib/domain/availability";
import { commissionCents } from "@/lib/domain/commission";
import { loyaltyDiscountPercent, slotDiscountPercent } from "@/lib/domain/offers";
import { PACK_ERRORS } from "@/lib/packs";
import { centsToEur, computeQuote, formatEur } from "@/lib/domain/pricing";
import { zonedDateString } from "@/lib/domain/time";
import { BUSINESS_CONTACT_COLUMNS, sendBookingConfirmation, type BusinessContact } from "@/lib/email/booking-emails";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { computeSlotWindow, loadPublicBusiness, offerRulesOf, pricingOf, resolveDistance } from "@/lib/marketplace";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/supabase/types";

const schema = z
  .object({
    business: z.string().min(3).max(60),
    service_id: z.uuid(),
    variant_key: z.string().max(40).nullable().default(null),
    addon_ids: z.array(z.uuid()).max(20).default([]),
    seats: z.number().int().min(1).max(50).default(1),
    staff_id: z.uuid().nullable().default(null),
    location_type: locationSchema,
    client_address: z.string().trim().max(200).optional().default(""),
    start_at: z.iso.datetime({ offset: true }),
    client_name: z.string().trim().min(2).max(80),
    client_email: z.email().trim().toLowerCase(),
    client_phone: z.string().trim().min(6).max(30),
    client_notes: z.string().trim().max(500).optional().default(""),
    beneficiary_name: z.string().trim().max(80).optional().default(""),
    pack_code: z.union([z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/), z.literal("")]).optional().default(""),
    source: z.enum(["marketplace", "direct", "assistant"]).default("marketplace"),
  })
  .refine((v) => v.location_type !== "at_home" || v.client_address.length >= 5, { path: ["client_address"] });

/** Frais de service plateforme prélevés sur l'acompte (0 par défaut ; voir PLATFORM_DEPOSIT_FEE_PERCENT). */
function applicationFee(depositCents: number): { application_fee_amount?: number } {
  const pct = Number(process.env.PLATFORM_DEPOSIT_FEE_PERCENT ?? "0");
  const fee = Math.round((depositCents * Math.min(Math.max(pct, 0), 20)) / 100);
  return fee > 0 ? { application_fee_amount: fee } : {};
}

const RPC_ERRORS: Record<string, { code: string; status: number }> = {
  SLOT_TAKEN: { code: "slot_taken", status: 409 },
  QUOTA_EXCEEDED: { code: "quota_exceeded", status: 403 },
  BUSINESS_NOT_FOUND: { code: "business_not_found", status: 404 },
};

export async function POST(request: Request) {
  if (!(await rateLimit("booking", request, 15, 600))) return jsonError("rate_limited", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const input = parsed.data;

  const business = await loadPublicBusiness(input.business);
  if (!business) return jsonError("business_not_found", 404);

  // 0. Anti-absences : réservation en ligne bloquée après N absences chez cet établissement.
  const adminCheck = createAdminClient();
  const { data: rules } = await adminCheck.from("businesses").select("no_show_block_threshold").eq("id", business.id).single<{ no_show_block_threshold: number }>();
  if (rules && rules.no_show_block_threshold > 0) {
    const { count } = await adminCheck.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "no_show").eq("client_email", input.client_email);
    if ((count ?? 0) >= rules.no_show_block_threshold) return jsonError("blocked_no_show", 403);
  }

  // 1. Sélection validée contre le catalogue réel.
  let sel;
  try {
    sel = await resolveSelection(business, {
      serviceId: input.service_id,
      variantKey: input.variant_key,
      location: input.location_type,
      addonIds: input.addon_ids,
      staffId: input.staff_id,
      seats: input.seats,
    });
  } catch (err) {
    if (err instanceof BookingInputError) return jsonError(err.message);
    throw err;
  }

  // 2. Distance et frais km recalculés côté serveur.
  let distanceKm: number | null = null;
  let clientAddress: string | null = null;
  if (input.location_type === "at_home") {
    const distance = await resolveDistance(business, input.client_address);
    if (!distance) return jsonError("address_not_found", 422);
    if (distance.outOfZone) return jsonError("out_of_zone", 422);
    distanceKm = distance.distanceKm;
    clientAddress = distance.label;
  }
  let quote = computeQuote({
    service: sel.service,
    variantKey: input.variant_key,
    addons: sel.addons,
    seats: sel.seats,
    locationType: input.location_type,
    distanceKm,
    business: pricingOf(business),
  });

  // 3. Le créneau doit correspondre exactement à un créneau libre recalculé.
  const startAt = new Date(input.start_at);
  const date = zonedDateString(startAt, siteConfig.booking.timeZone);
  const window = await computeSlotWindow({
    business,
    serviceId: sel.service.id,
    capacity: sel.service.capacity,
    durationMinutes: quote.blockedMinutes,
    staffIds: sel.staffIds,
    requestedStaffId: sel.requestedStaffId,
    seats: sel.seats,
    startDate: date,
    days: 1,
  });
  const slot = window.days[0]?.slots.find((s) => new Date(s.startAt).getTime() === startAt.getTime());
  if (!slot) return jsonError("slot_taken", 409);
  const quoteInput = { service: sel.service, variantKey: input.variant_key, addons: sel.addons, seats: sel.seats, locationType: input.location_type, distanceKm, business: pricingOf(business) };
  // Carnet : une séance débitée atomiquement (rendue si la création échoue ou si le RDV est annulé).
  let clientPackId: string | null = null;
  if (input.pack_code) {
    if (sel.seats !== 1) return jsonError("pack_single_seat", 422);
    const { data: packId, error: packError } = await createAdminClient().rpc("consume_pack_session", { p_code: input.pack_code, p_business_id: business.id, p_service_id: sel.service.id });
    if (packError || !packId) {
      const known = Object.entries(PACK_ERRORS).find(([key]) => packError?.message.includes(key));
      return known ? jsonError(known[1].code, known[1].status) : jsonError("pack_invalid", 422);
    }
    clientPackId = String(packId);
    quote = computeQuote({ ...quoteInput, coveredByPack: true });
  } else {
    // Remise du créneau (heures creuses / dernière minute) ou fidélité, la plus forte des deux, recalculée côté serveur.
    let discount = slotDiscountPercent(new Date(slot.startAt), new Date(), offerRulesOf(business), siteConfig.booking.timeZone);
    if (business.loyalty_every >= 2 && business.loyalty_percent > 0) {
      const { count: completed } = await createAdminClient().from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("client_email", input.client_email).eq("status", "completed");
      discount = Math.max(discount, loyaltyDiscountPercent(completed ?? 0, business.loyalty_every, business.loyalty_percent));
    }
    if (discount > 0) quote = computeQuote({ ...quoteInput, discountPercent: discount });
  }
  const freeStaff = slot.staffIds.filter((s): s is string => s !== null);
  const candidates = sel.requestedStaffId ? [] : rankStaffByLoad(freeStaff, window.bookings, date, new Date(), siteConfig.booking.timeZone);

  // Usager connecté : le RDV est rattaché à son compte.
  const session = await createSessionClient();
  const { data: auth } = await session.auth.getUser();

  const needsDeposit = quote.depositCents > 0;
  const needsGuarantee = !needsDeposit && quote.guaranteeFeeCents > 0;
  const admin = createAdminClient();

  // 4. Création atomique (verrou, quota, équipe, capacité, congés).
  const { data: booking, error } = await admin
    .rpc("create_booking_atomic", {
      p_business_id: business.id,
      p_service_id: sel.service.id,
      p_service_name: sel.service.name,
      p_variant_key: quote.variant?.key ?? null,
      p_variant_label: quote.variant?.label ?? null,
      p_addon_ids: sel.addons.map((a) => a.id),
      p_seats: sel.seats,
      p_staff_id: sel.requestedStaffId,
      p_candidate_staff: candidates,
      p_capacity: sel.service.capacity,
      p_location_type: input.location_type,
      p_client_address: clientAddress,
      p_distance_km: distanceKm,
      p_travel_fee_eur: centsToEur(quote.travelFeeCents),
      p_total_price_eur: centsToEur(quote.totalCents),
      p_deposit_amount_eur: centsToEur(quote.depositCents),
      p_client_user_id: auth.user?.id ?? null,
      p_client_name: input.client_name,
      p_client_email: input.client_email,
      p_client_phone: input.client_phone,
      p_client_notes: input.client_notes || null,
      p_start_at: slot.startAt,
      p_end_at: slot.endAt,
      p_status: needsDeposit || needsGuarantee ? "pending_deposit" : "scheduled",
      p_free_monthly_limit: siteConfig.pricing.freeMonthlyBookings,
      p_pending_ttl_minutes: siteConfig.booking.pendingDepositTtlMinutes,
    })
    .single<Booking>();

  if (error || !booking) {
    if (clientPackId) await admin.rpc("release_pack_session", { p_client_pack_id: clientPackId });
    const known = Object.entries(RPC_ERRORS).find(([key]) => error?.message.includes(key));
    if (known?.[0] === "QUOTA_EXCEEDED") {
      await alertQuotaBlocked(business.id, siteConfig.pricing.freeMonthlyBookings).catch((err) => logEvent("api.bookings.quotaAlert", errorMessage(err), {}, "warning"));
    }
    if (known) return jsonError(known[1].code, known[1].status);
    await logEvent("api.bookings", error?.message ?? "rpc returned no row", { business: input.business });
    return jsonError("server_error", 500);
  }

  // Monétisation : origine + commission « nouveau client marketplace » (plan Gratuit uniquement).
  const windowStart = new Date(Date.now() - siteConfig.pricing.newClientWindowDays * 86_400_000).toISOString();
  const { count: previous } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("client_email", input.client_email)
    .neq("id", booking.id)
    .neq("status", "cancelled")
    .gte("start_at", windowStart);
  const commission = commissionCents({
    plan: business.plan,
    source: input.source,
    isNewClient: (previous ?? 0) === 0,
    totalCents: quote.totalCents,
    percent: siteConfig.pricing.newClientCommissionPercent,
    capEur: siteConfig.pricing.newClientCommissionCapEur,
  });
  await admin
    .from("bookings")
    .update({ source: input.source, commission_eur: centsToEur(commission), discount_percent: quote.discountPercent, beneficiary_name: input.beneficiary_name || null, client_pack_id: clientPackId })
    .eq("id", booking.id);

  // Profil usager mémorisé pour pré-remplir les prochaines réservations.
  if (auth.user) {
    await admin.from("customer_profiles").upsert({ user_id: auth.user.id, full_name: input.client_name, phone: input.client_phone, ...(clientAddress ? { default_address: clientAddress } : {}) });
  }


  // 5a. Acompte : Checkout en charge directe sur le compte Connect de l'établissement.
  if (needsDeposit) {
    const { data: acct } = await admin.from("businesses").select("stripe_connect_account_id").eq("id", business.id).single<{ stripe_connect_account_id: string | null }>();
    try {
      if (!acct?.stripe_connect_account_id) throw new Error("connect account missing");
      const session = await getStripe().checkout.sessions.create(
        {
          mode: "payment",
          // Page de paiement intégrée à notre site : carte, Apple Pay, Google Pay, PayPal, Link…
          // (moyens de paiement dynamiques activés dans le tableau de bord Stripe du compte connecté).
          ui_mode: "embedded_page",
          customer_email: input.client_email,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: quote.depositCents,
                product_data: { name: `Acompte — ${sel.service.name}`, description: `${business.name}, rendez-vous du ${date}` },
              },
            },
          ],
          metadata: { booking_id: booking.id, business_id: business.id },
          payment_intent_data: { metadata: { booking_id: booking.id, business_id: business.id }, ...applicationFee(quote.depositCents) },
          // Minimum imposé par Stripe : 30 min. Le cron cleanup-pending expire la session plus tôt.
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          return_url: `${env.appUrl()}/paiement/${booking.confirm_token}/retour?session_id={CHECKOUT_SESSION_ID}`,
          locale: "fr",
        },
        { stripeAccount: acct.stripe_connect_account_id },
      );
      await admin.from("bookings").update({ stripe_checkout_session_id: session.id }).eq("id", booking.id);
      return json({ booking_id: booking.id, payment_url: `/paiement/${booking.confirm_token}` });
    } catch (err) {
      await admin.from("bookings").update({ status: "cancelled", cancelled_by: "system" }).eq("id", booking.id);
      await logEvent("api.bookings.checkout", errorMessage(err), { booking_id: booking.id });
      return jsonError("payment_unavailable", 502);
    }
  }

  // 5b. Empreinte bancaire : la carte est enregistrée sur le compte Connect du pro (mode « setup »), sans aucun débit.
  if (needsGuarantee) {
    const { data: acct } = await admin.from("businesses").select("stripe_connect_account_id, cancellation_hours").eq("id", business.id).single<{ stripe_connect_account_id: string | null; cancellation_hours: number }>();
    try {
      if (!acct?.stripe_connect_account_id) throw new Error("connect account missing");
      const stripeAccount = acct.stripe_connect_account_id;
      const customer = await getStripe().customers.create(
        { email: input.client_email, name: input.client_name, phone: input.client_phone || undefined, metadata: { booking_id: booking.id } },
        { stripeAccount, idempotencyKey: `guarantee-customer-${booking.id}` },
      );
      const fee = formatEur(quote.guaranteeFeeCents);
      const session = await getStripe().checkout.sessions.create(
        {
          mode: "setup",
          ui_mode: "embedded_page",
          currency: "eur",
          customer: customer.id,
          metadata: { booking_id: booking.id, business_id: business.id, kind: "guarantee" },
          setup_intent_data: {
            metadata: { booking_id: booking.id, business_id: business.id },
            description: `Garantie de rendez-vous — ${business.name}, ${date}`,
          },
          custom_text: {
            submit: {
              message: `Aucun débit aujourd'hui. Si vous ne venez pas sans avoir annulé${acct.cancellation_hours > 0 ? ` au moins ${acct.cancellation_hours} h avant` : ""}, ${fee} pourront être prélevés par ${business.name}.`,
            },
          },
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          return_url: `${env.appUrl()}/paiement/${booking.confirm_token}/retour?session_id={CHECKOUT_SESSION_ID}`,
          locale: "fr",
        },
        { stripeAccount },
      );
      await admin
        .from("bookings")
        .update({ stripe_checkout_session_id: session.id, stripe_customer_id: customer.id, guarantee_status: "pending", no_show_fee_eur: centsToEur(quote.guaranteeFeeCents) })
        .eq("id", booking.id);
      return json({ booking_id: booking.id, payment_url: `/paiement/${booking.confirm_token}` });
    } catch (err) {
      await admin.from("bookings").update({ status: "cancelled", cancelled_by: "system" }).eq("id", booking.id);
      await logEvent("api.bookings.guarantee", errorMessage(err), { booking_id: booking.id });
      return jsonError("payment_unavailable", 502);
    }
  }

  // 5c. Sans acompte : confirmation immédiate par email avec invitation .ics.
  try {
    const { data: contact } = await admin.from("businesses").select(BUSINESS_CONTACT_COLUMNS).eq("id", business.id).single<BusinessContact>();
    const staffName = booking.staff_id ? (sel.catalog.staff.find((s) => s.id === booking.staff_id)?.name ?? null) : null;
    if (contact) await sendBookingConfirmation(booking, contact, sel.addons.map((a) => a.name), staffName);
  } catch (err) {
    await logEvent("api.bookings.email", errorMessage(err), { booking_id: booking.id }, "warning");
  }
  return json({ booking_id: booking.id, status: booking.status });
}
