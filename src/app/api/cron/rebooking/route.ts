import { isAuthorizedCron, isParisHour, loadProBusinesses } from "@/lib/cron";
import { BUSINESS_CONTACT_COLUMNS, sendRebooking, sendReviewRequest, type BusinessContact } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Fenêtre de rattrapage : un cron manqué ne fait pas perdre la relance. */
const CATCH_UP_DAYS = 14;

/**
 * 10h (Paris), quotidien :
 * 1. Passe en « Terminé » les RDV passés depuis 48 h non marqués (le pro garde 48 h pour signaler une absence).
 * 2. Demande un avis vérifié aux clients venus (tous les plans : les avis nourrissent la marketplace).
 * 3. Relance de fidélisation après `rebooking_days` (plan Pro), une fois par client.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  if (!isParisHour(request, 10)) return json({ skipped: "not_10h_paris" });

  const admin = createAdminClient();
  const now = Date.now();

  const { data: completed } = await admin
    .from("bookings")
    .update({ status: "completed" })
    .in("status", ["scheduled", "confirmed", "at_risk"])
    .lt("end_at", new Date(now - 48 * HOUR).toISOString())
    .select("id");

  // 2. Demandes d'avis
  let reviews = 0;
  const { data: toReview } = await admin
    .from("bookings")
    .select("*")
    .eq("status", "completed")
    .eq("review_requested", false)
    .gt("end_at", new Date(now - 7 * DAY).toISOString())
    .limit(500)
    .returns<Booking[]>();
  const contacts = new Map<string, BusinessContact | null>();
  for (const b of toReview ?? []) {
    const { data: claimed } = await admin.from("bookings").update({ review_requested: true }).eq("id", b.id).eq("review_requested", false).select("id");
    if (!claimed?.length) continue;
    if (!contacts.has(b.business_id)) {
      const { data } = await admin.from("businesses").select(BUSINESS_CONTACT_COLUMNS).eq("id", b.business_id).maybeSingle<BusinessContact>();
      contacts.set(b.business_id, data);
    }
    const contact = contacts.get(b.business_id);
    if (!contact) continue;
    try {
      await sendReviewRequest(b, contact);
      reviews++;
    } catch (err) {
      await logEvent("cron.reviews", errorMessage(err), { booking_id: b.id }, "warning");
    }
  }

  // 3. Relance de fidélisation (Pro)
  let rebooked = 0;
  for (const business of await loadProBusinesses()) {
    const due = new Date(now - business.rebooking_days * DAY).toISOString();
    const floor = new Date(now - (business.rebooking_days + CATCH_UP_DAYS) * DAY).toISOString();
    const { data: candidates } = await admin
      .from("bookings")
      .select("*")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .eq("rebooking_sent", false)
      .lte("end_at", due)
      .gt("end_at", floor)
      .order("end_at", { ascending: false })
      .returns<Booking[]>();

    const seen = new Set<string>();
    for (const booking of candidates ?? []) {
      if (seen.has(booking.client_email)) continue;
      seen.add(booking.client_email);
      const { count } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("client_email", booking.client_email)
        .gt("start_at", booking.start_at)
        .not("status", "in", "(cancelled,no_show)");
      const { data: claimed } = await admin.from("bookings").update({ rebooking_sent: true }).eq("id", booking.id).eq("rebooking_sent", false).select("id");
      if (!claimed?.length || (count ?? 0) > 0) continue;
      try {
        await sendRebooking(booking, business);
        rebooked++;
      } catch (err) {
        await admin.from("bookings").update({ rebooking_sent: false }).eq("id", booking.id);
        await logEvent("cron.rebooking", errorMessage(err), { booking_id: booking.id });
      }
    }
  }
  return json({ auto_completed: completed?.length ?? 0, review_requests: reviews, rebooking: rebooked });
}
