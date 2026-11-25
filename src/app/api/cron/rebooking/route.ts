import { isAuthorizedCron, isParisHour, loadProStudios } from "@/lib/cron";
import { sendRebooking } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";

const DAY = 86_400_000;
/** Fenêtre de rattrapage : un cron manqué ne fait pas perdre la relance. */
const CATCH_UP_DAYS = 14;

/** 10h (Paris), Pro : relance entretien après `rebooking_days`, une seule fois par client. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  if (!isParisHour(request, 10)) return json({ skipped: "not_10h_paris" });

  const admin = createAdminClient();
  const now = Date.now();
  let sent = 0;

  for (const studio of await loadProStudios()) {
    const due = new Date(now - studio.rebooking_days * DAY).toISOString();
    const floor = new Date(now - (studio.rebooking_days + CATCH_UP_DAYS) * DAY).toISOString();
    const { data: candidates } = await admin
      .from("bookings")
      .select("*")
      .eq("studio_id", studio.id)
      .in("status", ["completed", "confirmed"])
      .eq("rebooking_sent", false)
      .lte("end_at", due)
      .gt("end_at", floor)
      .order("end_at", { ascending: false })
      .returns<Booking[]>();

    const seen = new Set<string>();
    for (const booking of candidates ?? []) {
      if (seen.has(booking.client_email)) continue;
      seen.add(booking.client_email);

      // Pas de relance si le client est déjà revenu ou a déjà un RDV prévu.
      const { count } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio.id)
        .eq("client_email", booking.client_email)
        .gt("start_at", booking.start_at)
        .not("status", "in", "(cancelled,no_show)");
      const { data: claimed } = await admin.from("bookings").update({ rebooking_sent: true }).eq("id", booking.id).eq("rebooking_sent", false).select("id");
      if (!claimed?.length || (count ?? 0) > 0) continue;

      try {
        const { data: service } = await admin.from("services").select("name").eq("id", booking.service_id ?? "").maybeSingle<{ name: string }>();
        await sendRebooking(booking, studio, service?.name ?? "detailing");
        sent++;
      } catch (err) {
        await admin.from("bookings").update({ rebooking_sent: false }).eq("id", booking.id);
        await logEvent("cron.rebooking", errorMessage(err), { booking_id: booking.id });
      }
    }
  }
  return json({ sent });
}
