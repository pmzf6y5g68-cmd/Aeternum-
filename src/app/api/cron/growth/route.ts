import { siteConfig } from "@/config/site";
import { isAuthorizedCron, isParisHour } from "@/lib/cron";
import { zonedParts, zonedTimeToUtc } from "@/lib/domain/time";
import { sendMonthlyReport, sendQuotaNudge } from "@/lib/email/pro-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { countMonthlyBookings } from "@/lib/pro";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business, OpeningHoursRow, Service } from "@/lib/supabase/types";
import { visibilityChecks, visibilityScore } from "@/lib/visibility";

const TZ = siteConfig.booking.timeZone;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * 9h (Paris), quotidien :
 * 1. Plan Gratuit à 80 % du quota mensuel : une proposition de passage en Pro par mois.
 * 2. Du 1er au 3 du mois : bilan du mois écoulé (vues, RDV, CA, avis, score) à chaque établissement publié.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  if (!isParisHour(request, 9)) return json({ skipped: "not_9h_paris" });

  const admin = createAdminClient();
  const now = new Date();
  const p = zonedParts(now, TZ);
  const current = monthKey(p.year, p.month);
  const limit = siteConfig.pricing.freeMonthlyBookings;

  // 1. Relance quota
  let nudged = 0;
  const { data: free } = await admin
    .from("businesses")
    .select("id, name, email, quota_nudge_month")
    .eq("plan", "free")
    .eq("published", true)
    .or(`quota_nudge_month.is.null,quota_nudge_month.neq.${current}`)
    .limit(3000)
    .returns<Pick<Business, "id" | "name" | "email" | "quota_nudge_month">[]>();
  for (const b of free ?? []) {
    const used = await countMonthlyBookings(admin, b.id, now);
    if (used < Math.ceil(limit * 0.8)) continue;
    const { data: claimed } = await admin.from("businesses").update({ quota_nudge_month: current }).eq("id", b.id).select("id");
    if (!claimed?.length) continue;
    try {
      await sendQuotaNudge(b, used, limit);
      nudged++;
    } catch (err) {
      await logEvent("cron.growth.nudge", errorMessage(err), { business_id: b.id }, "warning");
    }
  }

  // 2. Bilan mensuel
  let reports = 0;
  if (p.day <= 3) {
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    const prevMonth = p.month === 1 ? 12 : p.month - 1;
    const previous = monthKey(prevYear, prevMonth);
    const start = zonedTimeToUtc(`${previous}-01`, "00:00", TZ);
    const end = zonedTimeToUtc(`${current}-01`, "00:00", TZ);
    const { data: list } = await admin
      .from("businesses")
      .select("*")
      .eq("published", true)
      .or(`last_report_month.is.null,last_report_month.neq.${previous}`)
      .lt("created_at", end.toISOString())
      .limit(800)
      .returns<Business[]>();
    for (const b of list ?? []) {
      const { data: claimed } = await admin.from("businesses").update({ last_report_month: previous }).eq("id", b.id).select("id");
      if (!claimed?.length) continue;
      try {
        const [{ data: daily }, { data: bookings }, { count: newReviews }, { data: services }, { data: hours }] = await Promise.all([
          admin.from("business_daily_stats").select("views, widget_views").eq("business_id", b.id).gte("day", `${previous}-01`).lt("day", `${current}-01`).returns<{ views: number; widget_views: number }[]>(),
          admin.from("bookings").select("source, total_price_eur").eq("business_id", b.id).gte("start_at", start.toISOString()).lt("start_at", end.toISOString()).not("status", "in", "(cancelled,pending_deposit)").returns<{ source: string; total_price_eur: number }[]>(),
          admin.from("reviews").select("id", { count: "exact", head: true }).eq("business_id", b.id).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
          admin.from("services").select("description, active").eq("business_id", b.id).returns<Pick<Service, "description" | "active">[]>(),
          admin.from("opening_hours").select("*").eq("business_id", b.id).returns<OpeningHoursRow[]>(),
        ]);
        const views = (daily ?? []).reduce((s, d) => s + d.views + d.widget_views, 0);
        if (views === 0 && (bookings ?? []).length === 0) continue; // Rien à raconter : pas d'email vide.
        await sendMonthlyReport(b, {
          monthLabel: `${MONTHS[prevMonth - 1]} ${prevYear}`,
          views,
          bookings: (bookings ?? []).length,
          marketplaceBookings: (bookings ?? []).filter((x) => x.source !== "direct").length,
          revenueEur: (bookings ?? []).reduce((s, x) => s + Number(x.total_price_eur), 0),
          newReviews: newReviews ?? 0,
          score: visibilityScore(visibilityChecks({ business: b, services: services ?? [], hours: hours ?? [] })),
        });
        reports++;
      } catch (err) {
        await logEvent("cron.growth.report", errorMessage(err), { business_id: b.id }, "warning");
      }
    }
  }
  return json({ quota_nudges: nudged, monthly_reports: reports });
}
