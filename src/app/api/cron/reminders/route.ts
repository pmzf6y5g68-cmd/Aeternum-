import { hoursFromNow, isAuthorizedCron, loadProBusinesses } from "@/lib/cron";
import { sendReminder } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";

/** Toutes les heures (Pro) : rappel J-1 avec bouton de confirmation 1 clic. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  const businesses = await loadProBusinesses();
  if (!businesses.length) return json({ sent: 0 });
  const byId = new Map(businesses.map((s) => [s.id, s]));
  const admin = createAdminClient();

  const { data: bookings } = await admin
    .from("bookings")
    .select("*")
    .in("business_id", businesses.map((s) => s.id))
    .eq("status", "scheduled")
    .eq("reminder_sent", false)
    .gt("start_at", hoursFromNow(6))
    .lte("start_at", hoursFromNow(24))
    .returns<Booking[]>();

  let sent = 0;
  for (const booking of bookings ?? []) {
    const business = byId.get(booking.business_id);
    if (!business) continue;
    // Réservation atomique de l'envoi : aucun doublon même si deux crons se chevauchent.
    const { data: claimed } = await admin.from("bookings").update({ reminder_sent: true }).eq("id", booking.id).eq("reminder_sent", false).select("id");
    if (!claimed?.length) continue;
    try {
      await sendReminder(booking, business);
      sent++;
    } catch (err) {
      await admin.from("bookings").update({ reminder_sent: false }).eq("id", booking.id);
      await logEvent("cron.reminders", errorMessage(err), { booking_id: booking.id });
    }
  }
  return json({ sent });
}
