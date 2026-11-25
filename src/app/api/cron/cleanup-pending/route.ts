import { siteConfig } from "@/config/site";
import { isAuthorizedCron } from "@/lib/cron";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Toutes les 30 min : libère les créneaux dont l'acompte n'a pas été payé après 25 min. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - siteConfig.booking.pendingCleanupMinutes * 60_000).toISOString();

  const { data: expired, error } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("status", "pending_deposit")
    .lt("created_at", cutoff)
    .select("id, studio_id, stripe_checkout_session_id")
    .returns<{ id: string; studio_id: string; stripe_checkout_session_id: string | null }[]>();
  if (error) {
    await logEvent("cron.cleanup-pending", error.message);
    return jsonError("db_error", 500);
  }

  // Expire les sessions Checkout pour empêcher un paiement tardif (best effort).
  const withSession = (expired ?? []).filter((b) => b.stripe_checkout_session_id);
  let expiredSessions = 0;
  if (withSession.length) {
    const studioIds = Array.from(new Set(withSession.map((b) => b.studio_id)));
    const { data: studios } = await admin
      .from("studios")
      .select("id, stripe_connect_account_id")
      .in("id", studioIds)
      .returns<{ id: string; stripe_connect_account_id: string | null }[]>();
    const accounts = new Map((studios ?? []).map((s) => [s.id, s.stripe_connect_account_id]));
    for (const b of withSession) {
      const account = accounts.get(b.studio_id);
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
  return json({ released: expired?.length ?? 0, expired_sessions: expiredSessions });
}
