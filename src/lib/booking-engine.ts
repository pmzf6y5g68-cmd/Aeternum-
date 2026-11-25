import "server-only";
import { siteConfig } from "@/config/site";
import { computeAvailableSlots, type ExistingBooking, type Slot } from "@/lib/domain/availability";
import { geocodeAddress } from "@/lib/domain/geocode";
import { computeTravelFee, roadDistanceKm, type StudioForPricing } from "@/lib/domain/pricing";
import { addDays, zonedDateString, zonedTimeToUtc } from "@/lib/domain/time";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_STUDIO_COLUMNS, type Addon, type OpeningHoursRow, type PublicStudio, type Service } from "@/lib/supabase/types";

const TZ = siteConfig.booking.timeZone;

/** Infos publiques uniquement : aucune donnée de facturation ni client final. */
export async function loadPublicStudio(slug: string): Promise<PublicStudio | null> {
  if (!/^[a-z0-9-]{3,50}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("studios").select(PUBLIC_STUDIO_COLUMNS).eq("slug", slug).maybeSingle<PublicStudio>();
  return data;
}

export async function loadCatalog(studio: Pick<PublicStudio, "id" | "plan">): Promise<{ services: Service[]; addons: Addon[] }> {
  const admin = createAdminClient();
  const [services, addons] = await Promise.all([
    admin.from("services").select("*").eq("studio_id", studio.id).eq("active", true).order("base_price_eur").returns<Service[]>(),
    studio.plan === "pro"
      ? admin.from("addons").select("*").eq("studio_id", studio.id).eq("active", true).order("price_eur").returns<Addon[]>()
      : Promise.resolve({ data: [] as Addon[] }),
  ]);
  return { services: services.data ?? [], addons: addons.data ?? [] };
}

export function pricingStudio(studio: PublicStudio): StudioForPricing {
  return {
    free_radius_km: Number(studio.free_radius_km),
    max_radius_km: Number(studio.max_radius_km),
    price_per_extra_km: Number(studio.price_per_extra_km),
    travel_buffer_minutes: Number(studio.travel_buffer_minutes),
    deposit_enabled: studio.deposit_enabled,
    deposit_percent: Number(studio.deposit_percent),
    stripe_connect_onboarded: studio.stripe_connect_onboarded,
  };
}

export interface DistanceResult {
  label: string;
  distanceKm: number;
  feeCents: number;
  outOfZone: boolean;
}

export async function resolveDistance(studio: PublicStudio, address: string): Promise<DistanceResult | null> {
  if (studio.base_lat === null || studio.base_lng === null) return null;
  const geo = await geocodeAddress(address);
  if (!geo) return null;
  const distanceKm = roadDistanceKm({ lat: studio.base_lat, lng: studio.base_lng }, geo);
  const fee = computeTravelFee(distanceKm, pricingStudio(studio));
  return { label: geo.label, distanceKm, feeCents: fee.feeCents, outOfZone: fee.outOfZone };
}

export function bookingWindow(now: Date = new Date()): { min: string; max: string } {
  const min = zonedDateString(now, TZ);
  return { min, max: addDays(min, siteConfig.booking.maxDaysAhead) };
}

/** Recalcule les créneaux libres d'une date à partir de la base (jamais du client). */
export async function computeSlotsForDate(studioId: string, date: string, durationMinutes: number, now: Date = new Date()): Promise<Slot[]> {
  const window = bookingWindow(now);
  if (date < window.min || date > window.max) return [];

  const admin = createAdminClient();
  const dayStart = zonedTimeToUtc(date, "00:00", TZ);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), "00:00", TZ);
  const [hours, bookings] = await Promise.all([
    admin.from("opening_hours").select("*").eq("studio_id", studioId).returns<OpeningHoursRow[]>(),
    admin
      .from("bookings")
      .select("start_at, end_at, status, created_at")
      .eq("studio_id", studioId)
      .lt("start_at", dayEnd.toISOString())
      .gt("end_at", dayStart.toISOString())
      .not("status", "in", "(cancelled,no_show)")
      .returns<ExistingBooking[]>(),
  ]);

  return computeAvailableSlots({
    date,
    openingHours: hours.data ?? [],
    bookings: bookings.data ?? [],
    durationMinutes,
    now,
    stepMinutes: siteConfig.booking.slotStepMinutes,
    pendingTtlMinutes: siteConfig.booking.pendingDepositTtlMinutes,
    minLeadMinutes: siteConfig.booking.minLeadMinutes,
    timeZone: TZ,
  });
}

export function locationAllowed(studio: Pick<PublicStudio, "service_mode">, location: "workshop" | "mobile"): boolean {
  return studio.service_mode === "both" || studio.service_mode === location;
}
