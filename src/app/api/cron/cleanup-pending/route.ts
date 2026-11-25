import { siteConfig } from "@/config/site";
import { isAuthorizedCron } from "@/lib/cron";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWaitlistForSlot } from "@/lib/waitlist";

/** Toutes les 30 min : libère les créneaux dont l'acompte n'a pas été payé après 25 min. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - siteConfig.booking.pendingCleanupMinutes * 60_000).toISOString();

  const { data: expired, error } = await admin
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "system" })
    .eq("status", "pending_deposit")
    .lt("created_at", cutoff)
    .select("id, business_id, service_id, start_at, stripe_checkout_session_id")
    .returns<{ id: string; business_id: string; service_id: string | null; start_at: string; stripe_checkout_session_id: string | null }[]>();
  if (error) {
    await logEvent("cron.cleanup-pending", error.message);
    return jsonError("db_error", 500);
  }

  // Purge des compteurs anti-abus expirés.
  await admin.from("rate_limits").delete().lt("window_start", new Date(Date.now() - 2 * 3_600_000).toISOString());

  let waitlisted = 0;
  for (const b of expired ?? []) waitlisted += await notifyWaitlistForSlot(b);

  // Expire les sessions Checkout pour empêcher un paiement tardif (best effort).
  const withSession = (expired ?? []).filter((b) => b.stripe_checkout_session_id);
  let expiredSessions = 0;
  if (withSession.length) {
    const businessIds = Array.from(new Set(withSession.map((b) => b.business_id)));
    const { data: businesses } = await admin
      .from("businesses")
      .select("id, stripe_connect_account_id")
      .in("id", businessIds)
      .returns<{ id: string; stripe_connect_account_id: string | null }[]>();
    const accounts = new Map((businesses ?? []).map((s) => [s.id, s.stripe_connect_account_id]));
    for (const b of withSession) {
      const account = accounts.get(b.business_id);
      if (!account) continue;
      try {
        await getStripe().checkout.sessions.expire(b.stripe_checkout_session_id as string, {}, { stripeAccount: account });
        expiredSessions++;
      } catch (err) {
        // Déjà expirée ou payée : le webhook gère le paiement tardif.
        await logEvent("cron.cleanup-pending.expire", errorMessage(err), { booking_id: b.id }, "info");
      }
    }
  }
  return json({ released: expired?.length ?? 0, expired_sessions: expiredSessions, waitlist_notified: waitlisted });
}
