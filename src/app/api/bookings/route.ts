import { z } from "zod";
import { siteConfig } from "@/config/site";
import { computeSlotsForDate, loadCatalog, loadPublicStudio, locationAllowed, pricingStudio, resolveDistance } from "@/lib/booking-engine";
import { VEHICLE_SIZES, centsToEur, computeQuote } from "@/lib/domain/pricing";
import { zonedDateString } from "@/lib/domain/time";
import { sendBookingConfirmation } from "@/lib/email/booking-emails";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";

const schema = z
  .object({
    slug: z.string().min(3).max(50),
    service_id: z.uuid(),
    addon_ids: z.array(z.uuid()).max(20).default([]),
    size: z.enum(VEHICLE_SIZES),
    vehicle_model: z.string().trim().max(80).optional().default(""),
    location_type: z.enum(["workshop", "mobile"]),
    client_address: z.string().trim().max(200).optional().default(""),
    start_at: z.iso.datetime({ offset: true }),
    client_name: z.string().trim().min(2).max(80),
    client_email: z.email().trim().toLowerCase(),
    client_phone: z.string().trim().min(6).max(30),
  })
  .refine((v) => v.location_type === "workshop" || v.client_address.length >= 5, { path: ["client_address"] });

const RPC_ERRORS: Record<string, { code: string; status: number }> = {
  SLOT_TAKEN: { code: "slot_taken", status: 409 },
  QUOTA_EXCEEDED: { code: "quota_exceeded", status: 403 },
  STUDIO_NOT_FOUND: { code: "studio_not_found", status: 404 },
};

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const input = parsed.data;

  const studio = await loadPublicStudio(input.slug);
  if (!studio) return jsonError("studio_not_found", 404);
  if (!locationAllowed(studio, input.location_type)) return jsonError("location_not_offered");

  // 1. Recalcul serveur du catalogue, du prix, de la durée et des frais km.
  const { services, addons } = await loadCatalog(studio);
  const service = services.find((s) => s.id === input.service_id);
  if (!service) return jsonError("service_not_found", 404);
  const chosenAddons = addons.filter((a) => input.addon_ids.includes(a.id));

  let distanceKm: number | null = null;
  let clientAddress: string | null = null;
  if (input.location_type === "mobile") {
    const distance = await resolveDistance(studio, input.client_address);
    if (!distance) return jsonError("address_not_found", 422);
    if (distance.outOfZone) return jsonError("out_of_zone", 422);
    distanceKm = distance.distanceKm;
    clientAddress = distance.label;
  }

  const quote = computeQuote({
    service,
    addons: chosenAddons,
    size: input.size,
    locationType: input.location_type,
    distanceKm,
    studio: pricingStudio(studio),
  });

  // 2. Le créneau demandé doit correspondre exactement à un créneau libre recalculé.
  const startAt = new Date(input.start_at);
  const date = zonedDateString(startAt, siteConfig.booking.timeZone);
  const slots = await computeSlotsForDate(studio.id, date, quote.blockedMinutes);
  const slot = slots.find((s) => new Date(s.startAt).getTime() === startAt.getTime());
  if (!slot) return jsonError("slot_taken", 409);

  const needsDeposit = quote.depositCents > 0;
  const admin = createAdminClient();

  // 3. Création atomique (verrou FOR UPDATE sur le studio, quota, chevauchement).
  const { data: booking, error } = await admin
    .rpc("create_booking_atomic", {
      p_studio_id: studio.id,
      p_service_id: service.id,
      p_addon_ids: chosenAddons.map((a) => a.id),
      p_vehicle_size: input.size,
      p_vehicle_model: input.vehicle_model || null,
      p_location_type: input.location_type,
      p_client_address: clientAddress,
      p_distance_km: distanceKm,
      p_travel_fee_eur: centsToEur(quote.travelFeeCents),
      p_total_price_eur: centsToEur(quote.totalCents),
      p_deposit_amount_eur: centsToEur(quote.depositCents),
      p_client_name: input.client_name,
      p_client_email: input.client_email,
      p_client_phone: input.client_phone,
      p_start_at: slot.startAt,
      p_end_at: slot.endAt,
      p_status: needsDeposit ? "pending_deposit" : "scheduled",
      p_free_monthly_limit: siteConfig.pricing.freeMonthlyBookings,
      p_pending_ttl_minutes: siteConfig.booking.pendingDepositTtlMinutes,
    })
    .single<Booking>();

  if (error || !booking) {
    const known = Object.entries(RPC_ERRORS).find(([key]) => error?.message.includes(key));
    if (known) return jsonError(known[1].code, known[1].status);
    await logEvent("api.bookings", error?.message ?? "rpc returned no row", { slug: input.slug });
    return jsonError("server_error", 500);
  }

  // 4a. Acompte : Checkout en charge directe sur le compte Connect du studio.
  if (needsDeposit) {
    const { data: acct } = await admin.from("studios").select("stripe_connect_account_id").eq("id", studio.id).single<{ stripe_connect_account_id: string | null }>();
    try {
      if (!acct?.stripe_connect_account_id) throw new Error("connect account missing");
      const session = await getStripe().checkout.sessions.create(
        {
          mode: "payment",
          customer_email: input.client_email,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: quote.depositCents,
                product_data: { name: `Acompte — ${service.name}`, description: `${studio.name}, RDV du ${date}` },
              },
            },
          ],
          metadata: { booking_id: booking.id, studio_id: studio.id },
          payment_intent_data: { metadata: { booking_id: booking.id, studio_id: studio.id } },
          // Minimum imposé par Stripe : 30 min. Le cron cleanup-pending expire la session plus tôt.
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
          success_url: `${env.appUrl()}/${studio.slug}?booking=success`,
          cancel_url: `${env.appUrl()}/${studio.slug}?booking=cancelled`,
          locale: "fr",
        },
        { stripeAccount: acct.stripe_connect_account_id },
      );
      await admin.from("bookings").update({ stripe_checkout_session_id: session.id }).eq("id", booking.id);
      return json({ booking_id: booking.id, checkout_url: session.url });
    } catch (err) {
      await admin.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      await logEvent("api.bookings.checkout", errorMessage(err), { booking_id: booking.id });
      return jsonError("payment_unavailable", 502);
    }
  }

  // 4b. Sans acompte : confirmation immédiate par email avec invitation .ics.
  try {
    const { data: contact } = await admin.from("studios").select("name, email, phone, address, slug").eq("id", studio.id).single();
    if (contact) await sendBookingConfirmation(booking, contact, service.name, chosenAddons.map((a) => a.name));
  } catch (err) {
    await logEvent("api.bookings.email", errorMessage(err), { booking_id: booking.id }, "warning");
  }
  return json({ booking_id: booking.id, status: booking.status });
}
