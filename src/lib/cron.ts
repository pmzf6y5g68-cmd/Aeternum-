import "server-only";
import { siteConfig } from "@/config/site";
import { zonedParts } from "@/lib/domain/time";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/prefill";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/supabase/types";

/** Crons protégés par `Authorization: Bearer ${CRON_SECRET}`. */
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(token, env.cronSecret());
}

/**
 * Les planificateurs (GitHub Actions) tournent en UTC : on déclenche aux deux heures UTC possibles
 * (heure d'hiver / d'été) et la route ne s'exécute qu'à l'heure de Paris voulue, sauf `?force=1`.
 */
export function isParisHour(request: Request, hour: number, now: Date = new Date()): boolean {
  if (new URL(request.url).searchParams.get("force") === "1") return true;
  return zonedParts(now, siteConfig.booking.timeZone).hour === hour;
}

export async function loadProBusinesses(): Promise<Business[]> {
  const { data } = await createAdminClient().from("businesses").select("*").eq("plan", "pro").returns<Business[]>();
  return data ?? [];
}

export function hoursFromNow(hours: number, now: Date = new Date()): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}
