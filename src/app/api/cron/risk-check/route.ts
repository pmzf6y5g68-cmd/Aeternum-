import { hoursFromNow, isAuthorizedCron, loadProStudios } from "@/lib/cron";
import { sendRiskAlert } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";

/** Toutes les heures (Pro) : alerte le detailer à H-6 si le client n'a pas confirmé le rappel. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  const studios = await loadProStudios();
  if (!studios.length) return json({ alerted: 0 });
  const byId = new Map(studios.map((s) => [s.id, s]));
  const admin = createAdminClient();

  const { data: bookings } = await admin
    .from("bookings")
    .select("*")
    .in("studio_id", studios.map((s) => s.id))
    .eq("status", "scheduled")
    .eq("reminder_sent", true)
    .eq("risk_alert_sent", false)
    .gt("start_at", new Date().toISOString())
    .lte("start_at", hoursFromNow(6))
    .returns<Booking[]>();

  let alerted = 0;
  for (const booking of bookings ?? []) {
    const studio = byId.get(booking.studio_id);
    if (!studio) continue;
    const { data: claimed } = await admin
      .from("bookings")
      .update({ status: "at_risk", risk_alert_sent: true })
      .eq("id", booking.id)
      .eq("status", "scheduled")
      .eq("risk_alert_sent", false)
      .select("id");
    if (!claimed?.length) continue;
    try {
      await sendRiskAlert(booking, studio);
      alerted++;
    } catch (err) {
      await logEvent("cron.risk-check", errorMessage(err), { booking_id: booking.id });
    }
  }
  return json({ alerted });
}
