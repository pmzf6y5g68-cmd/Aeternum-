import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { zonedParts, zonedTimeToUtc } from "@/lib/domain/time";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Studio } from "@/lib/supabase/types";

export async function getOwnStudio() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { supabase, user: null, studio: null };
  const { data } = await supabase.from("studios").select("*").eq("owner_id", user.id).maybeSingle<Studio>();
  return { supabase, user, studio: data };
}

/** Pour les pages du dashboard : redirige vers /login ou /onboarding si nécessaire. */
export async function requireStudio() {
  const { supabase, user, studio } = await getOwnStudio();
  if (!user) redirect("/login?next=/dashboard");
  if (!studio) redirect("/onboarding");
  return { supabase, user, studio };
}

/** Bornes UTC du mois civil courant (heure de Paris). */
export function currentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const p = zonedParts(now, siteConfig.booking.timeZone);
  const month = String(p.month).padStart(2, "0");
  const nextYear = p.month === 12 ? p.year + 1 : p.year;
  const nextMonth = String(p.month === 12 ? 1 : p.month + 1).padStart(2, "0");
  return {
    start: zonedTimeToUtc(`${p.year}-${month}-01`, "00:00", siteConfig.booking.timeZone),
    end: zonedTimeToUtc(`${nextYear}-${nextMonth}-01`, "00:00", siteConfig.booking.timeZone),
  };
}

export async function countMonthlyBookings(client: SupabaseClient, studioId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = currentMonthRange(now);
  const { count } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .neq("status", "cancelled");
  return count ?? 0;
}

export function publicStudioUrl(slug: string): string {
  return `${siteConfig.url.replace(/\/$/, "")}/${slug}`;
}
