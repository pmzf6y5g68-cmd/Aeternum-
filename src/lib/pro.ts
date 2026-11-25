import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { zonedParts, zonedTimeToUtc } from "@/lib/domain/time";
import { businessPath } from "@/lib/slug";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/server";
import type { Business } from "@/lib/supabase/types";

export async function getOwnBusiness() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { supabase, user: null, business: null };
  const { data } = await supabase.from("businesses").select("*").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle<Business>();
  return { supabase, user, business: data };
}

/** Pages de l'espace pro : redirige vers /login ou /pro/inscription si nécessaire. */
export async function requireBusiness() {
  const { supabase, user, business } = await getOwnBusiness();
  if (!user) redirect("/login?next=/pro/agenda");
  if (!business) redirect("/pro/inscription");
  return { supabase, user, business };
}

/** Routes API de l'espace pro. */
export async function getApiBusiness(): Promise<Business | null> {
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("businesses").select("*").eq("owner_id", auth.user.id).order("created_at").limit(1).maybeSingle<Business>();
  return data;
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

export async function countMonthlyBookings(client: SupabaseClient, businessId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = currentMonthRange(now);
  const { count } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .neq("status", "cancelled");
  return count ?? 0;
}

export function publicBusinessUrl(b: Pick<Business, "category" | "city_slug" | "slug">): string {
  return `${siteConfig.url.replace(/\/$/, "")}${businessPath(b)}`;
}

/** Lien à diffuser par le professionnel lui-même : ses clients réservent sans commission. */
export function shareBusinessUrl(b: Pick<Business, "category" | "city_slug" | "slug">): string {
  return `${publicBusinessUrl(b)}?via=pro`;
}
