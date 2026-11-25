import { siteConfig } from "@/config/site";
import { isAuthorizedCron, isParisHour } from "@/lib/cron";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;

type Filter = ["eq" | "neq" | "gte", string, string];

async function count(table: string, filters: Filter[] = []): Promise<number> {
  let query = createAdminClient().from(table).select("id", { count: "exact", head: true });
  for (const [op, column, value] of filters) query = query[op](column, value);
  const { count: n } = await query;
  return n ?? 0;
}

function isSundayInParis(now: Date): boolean {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: siteConfig.booking.timeZone }).format(now) === "Sun";
}

/**
 * 20h (Paris) : bilan envoyé à OWNER_ALERT_EMAIL uniquement s'il y a des escalades en attente
 * ou des erreurs système — et chaque dimanche pour le récap hebdo (MRR, prospects, studios).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  if (!isParisHour(request, 20)) return json({ skipped: "not_20h_paris" });

  const admin = createAdminClient();
  const now = Date.now();
  const since24h = new Date(now - DAY).toISOString();
  const since7d = new Date(now - 7 * DAY).toISOString();

  const [escalated, errors, prospectErrors] = await Promise.all([
    admin
      .from("email_threads")
      .select("id, contact_email, subject, updated_at")
      .eq("status", "escalated")
      .gte("updated_at", new Date(now - 14 * DAY).toISOString())
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<{ id: string; contact_email: string; subject: string | null; updated_at: string }[]>(),
    admin
      .from("system_events")
      .select("source, message, created_at")
      .eq("level", "error")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<{ source: string; message: string; created_at: string }[]>(),
    count("prospects", [["eq", "status", "error"], ["gte", "last_contacted_at", since24h]]),
  ]);

  const escalations = escalated.data ?? [];
  const systemErrors = errors.data ?? [];
  const isSunday = new URL(request.url).searchParams.get("weekly") === "1" || isSundayInParis(new Date(now));
  const hasAnomaly = escalations.length > 0 || systemErrors.length > 0 || prospectErrors > 0;

  if (!hasAnomaly && !isSunday) return json({ sent: false, reason: "all_good" });

  const lines: string[] = [];
  if (escalations.length) {
    lines.push(`🔴 ${escalations.length} fil(s) escaladé(s) en attente de réponse humaine :`);
    for (const t of escalations) lines.push(`• ${t.contact_email} — ${t.subject ?? "(sans objet)"} — ${t.updated_at.slice(0, 16).replace("T", " ")}`);
  }
  if (systemErrors.length) {
    lines.push(`⚠️ ${systemErrors.length} erreur(s) système sur 24 h :`);
    for (const e of systemErrors.slice(0, 15)) lines.push(`• [${e.source}] ${e.message.slice(0, 180)}`);
  }
  if (prospectErrors) lines.push(`⚠️ ${prospectErrors} prospect(s) en erreur d'envoi sur 24 h.`);

  if (isSunday) {
    const [pro, studiosTotal, newStudios, sent, replied, converted, stopped, bookings] = await Promise.all([
      count("studios", [["eq", "plan", "pro"]]),
      count("studios"),
      count("studios", [["gte", "created_at", since7d]]),
      count("prospects", [["gte", "last_contacted_at", since7d]]),
      count("email_messages", [["eq", "direction", "inbound"], ["gte", "created_at", since7d]]),
      count("prospects", [["eq", "status", "converted"]]),
      count("prospects", [["eq", "status", "stopped"]]),
      count("bookings", [["gte", "created_at", since7d], ["neq", "status", "cancelled"]]),
    ]);
    lines.push(
      "📊 Récap hebdo",
      `• MRR : ${pro * siteConfig.pricing.proMonthlyPriceEur} € (${pro} studio(s) Pro sur ${studiosTotal})`,
      `• Nouveaux studios (7 j) : ${newStudios}`,
      `• Prospects contactés (7 j) : ${sent} · emails reçus : ${replied}`,
      `• Prospects convertis (total) : ${converted} · opt-out : ${stopped}`,
      `• RDV créés (7 j) : ${bookings}`,
    );
  }

  try {
    await sendEmail({
      to: env.ownerAlertEmail(),
      subject: hasAnomaly ? `[Slotly] ${escalations.length} escalade(s), ${systemErrors.length} erreur(s)` : "[Slotly] Récap hebdomadaire",
      text: lines.join("\n"),
      html: layoutHtml(hasAnomaly ? "Bilan de santé Slotly" : "Récap hebdomadaire Slotly", lines),
    });
  } catch (err) {
    await logEvent("cron.health-digest", errorMessage(err));
    return jsonError("send_failed", 502);
  }
  return json({ sent: true, escalations: escalations.length, errors: systemErrors.length });
}
