import "server-only";
import { siteConfig } from "@/config/site";
import { computeSlotsForRange, type DaySlots, type ExistingBooking, type OpeningHours, type TimeOff } from "@/lib/domain/availability";
import { geocodeAddress } from "@/lib/domain/geocode";
import { computeTravelFee, roadDistanceKm, type BusinessForPricing } from "@/lib/domain/pricing";
import { addDays, zonedDateString, zonedTimeToUtc } from "@/lib/domain/time";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PUBLIC_BUSINESS_COLUMNS,
  type Addon,
  type OpeningHoursRow,
  type PublicBusiness,
  type Review,
  type SearchRow,
  type Service,
  type Staff,
} from "@/lib/supabase/types";

const TZ = siteConfig.booking.timeZone;

export const SORTS = ["relevance", "distance", "availability", "price_asc", "price_desc", "rating"] as const;
export type SortKey = (typeof SORTS)[number];
export const AVAILABILITY_FILTERS = ["any", "today", "3d", "7d"] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

export interface SearchParams {
  q?: string | null;
  category?: string | null;
  citySlug?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  maxPrice?: number | null;
  mode?: "on_site" | "at_home" | "online" | null;
  minRating?: number | null;
  availability?: AvailabilityFilter;
  sort?: SortKey;
  page?: number;
}

export interface SearchResult extends SearchRow {
  preview: DaySlots[];
  nextSlotAt: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageCount: number;
}

const WINDOW_DAYS: Record<AvailabilityFilter, number> = { any: 0, today: 1, "3d": 3, "7d": 7 };

/** Recherche + aperçu des créneaux. Les filtres/tri de disponibilité sont appliqués après calcul. */
export async function searchBusinesses(params: SearchParams, now: Date = new Date()): Promise<SearchResponse> {
  const pageSize = siteConfig.search.pageSize;
  const page = Math.max(1, params.page ?? 1);
  const availability = params.availability ?? "any";
  const sort: SortKey = params.sort ?? (!params.q && params.lat != null ? "distance" : "relevance");
  const needsAvailabilityPass = availability !== "any" || sort === "availability";

  const { data, error } = await createAdminClient().rpc("search_businesses", {
    p_query: params.q || null,
    p_category: params.category || null,
    p_city_slug: params.citySlug || null,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_radius_km: params.lat != null ? (params.radiusKm ?? siteConfig.search.defaultRadiusKm) : null,
    p_max_price: params.maxPrice ?? null,
    p_mode: params.mode ?? null,
    p_min_rating: params.minRating ?? null,
    p_sort: sort === "availability" ? "relevance" : sort,
    p_limit: needsAvailabilityPass ? 100 : pageSize,
    p_offset: needsAvailabilityPass ? 0 : (page - 1) * pageSize,
  });
  if (error) throw new Error(`search: ${error.message}`);
  const rows = (data ?? []) as SearchRow[];

  if (!needsAvailabilityPass) {
    const total = Number(rows[0]?.total_count ?? 0);
    const previews = await previewAvailability(rows.map((r) => r.id), now);
    return {
      results: rows.map((r) => withPreview(r, previews.get(r.id) ?? [])),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const previews = await previewAvailability(rows.map((r) => r.id), now, Math.max(siteConfig.search.previewDays, WINDOW_DAYS[availability], 14));
  let results = rows.map((r) => withPreview(r, previews.get(r.id) ?? []));
  if (availability !== "any") {
    const limit = zonedTimeToUtc(addDays(zonedDateString(now, TZ), WINDOW_DAYS[availability]), "00:00", TZ).getTime();
    results = results.filter((r) => r.nextSlotAt !== null && new Date(r.nextSlotAt).getTime() < limit);
  }
  if (sort === "availability") {
    results.sort((a, b) => (a.nextSlotAt ? new Date(a.nextSlotAt).getTime() : Infinity) - (b.nextSlotAt ? new Date(b.nextSlotAt).getTime() : Infinity));
  }
  const total = results.length;
  const sliced = results.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ ...r, preview: r.preview.slice(0, siteConfig.search.previewDays) }));
  return { results: sliced, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function withPreview(row: SearchRow, days: DaySlots[]): SearchResult {
  let nextSlotAt: string | null = null;
  for (const d of days) {
    if (d.slots[0]) {
      nextSlotAt = d.slots[0].startAt;
      break;
    }
  }
  return { ...row, distance_km: row.distance_km === null ? null : Number(row.distance_km), preview: days, nextSlotAt };
}

interface PreviewBusiness {
  id: string;
  slot_step_minutes: number;
  min_lead_minutes: number;
  max_days_ahead: number;
}

/**
 * Aperçu des créneaux de plusieurs établissements en 6 requêtes, pour la prestation
 * de référence (la plus courte), tous membres confondus.
 */
export async function previewAvailability(ids: string[], now: Date, days: number = siteConfig.search.previewDays): Promise<Map<string, DaySlots[]>> {
  const out = new Map<string, DaySlots[]>();
  if (ids.length === 0) return out;
  const admin = createAdminClient();
  const start = zonedDateString(now, TZ);
  const from = zonedTimeToUtc(start, "00:00", TZ).toISOString();
  const to = zonedTimeToUtc(addDays(start, days), "00:00", TZ).toISOString();

  const [biz, services, staff, hours, bookings, offs] = await Promise.all([
    admin.from("businesses").select("id, slot_step_minutes, min_lead_minutes, max_days_ahead").in("id", ids).returns<PreviewBusiness[]>(),
    admin.from("services").select("id, business_id, duration_minutes, capacity").in("business_id", ids).eq("active", true).returns<Pick<Service, "id" | "business_id" | "duration_minutes" | "capacity">[]>(),
    admin.from("staff").select("id, business_id, service_ids").in("business_id", ids).eq("active", true).returns<Pick<Staff, "id" | "business_id" | "service_ids">[]>(),
    admin.from("opening_hours").select("*").in("business_id", ids).returns<OpeningHoursRow[]>(),
    admin
      .from("bookings")
      .select("business_id, start_at, end_at, status, created_at, staff_id, service_id, seats")
      .in("business_id", ids)
      .lt("start_at", to)
      .gt("end_at", from)
      .not("status", "in", "(cancelled,no_show)")
      .returns<(ExistingBooking & { business_id: string })[]>(),
    admin.from("time_off").select("business_id, start_at, end_at, staff_id").in("business_id", ids).lt("start_at", to).gt("end_at", from).returns<(TimeOff & { business_id: string })[]>(),
  ]);

  const group = <T extends { business_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.business_id, [...(m.get(r.business_id) ?? []), r]);
    return m;
  };
  const servicesBy = group(services.data);
  const staffBy = group(staff.data);
  const hoursBy = group(hours.data);
  const bookingsBy = group(bookings.data);
  const offsBy = group(offs.data);

  for (const b of biz.data ?? []) {
    const reference = [...(servicesBy.get(b.id) ?? [])].sort((x, y) => x.duration_minutes - y.duration_minutes)[0];
    if (!reference) {
      out.set(b.id, []);
      continue;
    }
    const staffIds = (staffBy.get(b.id) ?? []).filter((s) => s.service_ids.length === 0 || s.service_ids.includes(reference.id)).map((s) => s.id);
    const hasTeam = (staffBy.get(b.id) ?? []).length > 0;
    out.set(
      b.id,
      hasTeam && staffIds.length === 0
        ? []
        : computeSlotsForRange(
            {
              openingHours: (hoursBy.get(b.id) ?? []) as OpeningHours[],
              bookings: bookingsBy.get(b.id) ?? [],
              timeOff: offsBy.get(b.id) ?? [],
              staffIds,
              serviceId: reference.id,
              capacity: reference.capacity,
              durationMinutes: reference.duration_minutes,
              now,
              stepMinutes: b.slot_step_minutes,
              minLeadMinutes: b.min_lead_minutes,
              pendingTtlMinutes: siteConfig.booking.pendingDepositTtlMinutes,
              timeZone: TZ,
            },
            start,
            Math.min(days, b.max_days_ahead),
          ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fiche établissement
// ---------------------------------------------------------------------------
export async function loadPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("businesses").select(PUBLIC_BUSINESS_COLUMNS).eq("slug", slug).eq("published", true).maybeSingle<PublicBusiness>();
  return data;
}

export interface BusinessCatalog {
  services: Service[];
  addons: Addon[];
  staff: Pick<Staff, "id" | "name" | "title" | "service_ids">[];
  hours: OpeningHoursRow[];
  reviews: Review[];
}

export async function loadCatalog(business: Pick<PublicBusiness, "id" | "plan">): Promise<BusinessCatalog> {
  const admin = createAdminClient();
  const [services, addons, staff, hours, reviews] = await Promise.all([
    admin.from("services").select("*").eq("business_id", business.id).eq("active", true).order("sort").order("price_eur").returns<Service[]>(),
    business.plan === "pro"
      ? admin.from("addons").select("*").eq("business_id", business.id).eq("active", true).order("price_eur").returns<Addon[]>()
      : Promise.resolve({ data: [] as Addon[] }),
    admin.from("staff").select("id, name, title, service_ids").eq("business_id", business.id).eq("active", true).order("sort").order("name").returns<Pick<Staff, "id" | "name" | "title" | "service_ids">[]>(),
    admin.from("opening_hours").select("*").eq("business_id", business.id).returns<OpeningHoursRow[]>(),
    admin.from("reviews").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20).returns<Review[]>(),
  ]);
  return { services: services.data ?? [], addons: addons.data ?? [], staff: staff.data ?? [], hours: hours.data ?? [], reviews: reviews.data ?? [] };
}

export function eligibleStaffIds(staff: Pick<Staff, "id" | "service_ids">[], serviceId: string): string[] {
  return staff.filter((s) => s.service_ids.length === 0 || s.service_ids.includes(serviceId)).map((s) => s.id);
}

export function pricingOf(b: PublicBusiness): BusinessForPricing {
  return {
    free_radius_km: Number(b.free_radius_km),
    max_radius_km: Number(b.max_radius_km),
    price_per_extra_km: Number(b.price_per_extra_km),
    travel_buffer_minutes: Number(b.travel_buffer_minutes),
    deposit_enabled: b.deposit_enabled,
    deposit_percent: Number(b.deposit_percent),
    stripe_connect_onboarded: b.stripe_connect_onboarded,
  };
}

export interface DistanceResult {
  label: string;
  distanceKm: number;
  feeCents: number;
  outOfZone: boolean;
}

export async function resolveDistance(b: PublicBusiness, address: string): Promise<DistanceResult | null> {
  if (b.lat === null || b.lng === null) return null;
  const geo = await geocodeAddress(address);
  if (!geo) return null;
  const distanceKm = roadDistanceKm({ lat: b.lat, lng: b.lng }, geo);
  const fee = computeTravelFee(distanceKm, pricingOf(b));
  return { label: geo.label, distanceKm, feeCents: fee.feeCents, outOfZone: fee.outOfZone };
}

export interface SlotQuery {
  business: PublicBusiness;
  serviceId: string;
  capacity: number;
  durationMinutes: number;
  staffIds: string[];
  requestedStaffId: string | null;
  seats: number;
  startDate: string;
  days: number;
}

export interface SlotWindow {
  days: DaySlots[];
  nextAvailable: string | null;
  bookings: ExistingBooking[];
}

/** Créneaux d'une fenêtre + première date disponible au-delà (bouton « Prochaine disponibilité »). */
export async function computeSlotWindow(q: SlotQuery, now: Date = new Date()): Promise<SlotWindow> {
  const today = zonedDateString(now, TZ);
  const lastDate = addDays(today, q.business.max_days_ahead);
  const startDate = q.startDate < today ? today : q.startDate;
  const scanEnd = lastDate;
  const from = zonedTimeToUtc(today, "00:00", TZ).toISOString();
  const to = zonedTimeToUtc(addDays(scanEnd, 1), "00:00", TZ).toISOString();

  const admin = createAdminClient();
  const [hours, bookings, offs] = await Promise.all([
    admin.from("opening_hours").select("*").eq("business_id", q.business.id).returns<OpeningHoursRow[]>(),
    admin
      .from("bookings")
      .select("start_at, end_at, status, created_at, staff_id, service_id, seats")
      .eq("business_id", q.business.id)
      .lt("start_at", to)
      .gt("end_at", from)
      .not("status", "in", "(cancelled,no_show)")
      .returns<ExistingBooking[]>(),
    admin.from("time_off").select("start_at, end_at, staff_id").eq("business_id", q.business.id).lt("start_at", to).gt("end_at", from).returns<TimeOff[]>(),
  ]);

  const base = {
    openingHours: hours.data ?? [],
    bookings: bookings.data ?? [],
    timeOff: offs.data ?? [],
    staffIds: q.staffIds,
    requestedStaffId: q.requestedStaffId,
    serviceId: q.serviceId,
    capacity: q.capacity,
    seats: q.seats,
    durationMinutes: q.durationMinutes,
    now,
    stepMinutes: q.business.slot_step_minutes,
    minLeadMinutes: q.business.min_lead_minutes,
    pendingTtlMinutes: siteConfig.booking.pendingDepositTtlMinutes,
    timeZone: TZ,
  };

  const windowDays = Math.max(0, Math.min(q.days, daysBetween(startDate, lastDate) + 1));
  const days = startDate > lastDate ? [] : computeSlotsForRange(base, startDate, windowDays);
  let nextAvailable: string | null = null;
  if (!days.some((d) => d.slots.length > 0)) {
    const afterStart = addDays(startDate, windowDays);
    const remaining = daysBetween(afterStart, lastDate) + 1;
    if (remaining > 0) {
      for (const d of computeSlotsForRange(base, afterStart, remaining)) {
        if (d.slots.length) {
          nextAvailable = d.date;
          break;
        }
      }
    }
  }
  return { days, nextAvailable, bookings: bookings.data ?? [] };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);
}

export async function topCitiesForCategory(category: string, limit = 12): Promise<{ city: string; city_slug: string; count: number }[]> {
  const { data } = await createAdminClient()
    .from("businesses")
    .select("city, city_slug")
    .eq("category", category)
    .eq("published", true)
    .not("min_price_eur", "is", null)
    .limit(2000)
    .returns<{ city: string | null; city_slug: string | null }[]>();
  const counts = new Map<string, { city: string; city_slug: string; count: number }>();
  for (const r of data ?? []) {
    if (!r.city || !r.city_slug) continue;
    const c = counts.get(r.city_slug) ?? { city: r.city, city_slug: r.city_slug, count: 0 };
    c.count++;
    counts.set(r.city_slug, c);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Statistiques publiques d'un métier (et d'une ville) pour les FAQ et données structurées. */
export async function loadCategoryStats(category: string, citySlug: string | null = null): Promise<import("@/lib/seo").CategoryStats | null> {
  try {
    const { data } = await createAdminClient().rpc("category_stats", { p_category: category, p_city_slug: citySlug }).single<import("@/lib/seo").CategoryStats>();
    return data ?? null;
  } catch {
    return null;
  }
}
