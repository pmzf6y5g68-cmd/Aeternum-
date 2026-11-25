import "server-only";
import { z } from "zod";
import { getCategory, matchCategories, normalizeText } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { geocodeAddress } from "@/lib/domain/geocode";
import { servicePrice } from "@/lib/domain/pricing";
import { isValidDateString, zonedDateString } from "@/lib/domain/time";
import { computeSlotWindow, eligibleStaffIds, loadCatalog, loadPublicBusiness, searchBusinesses } from "@/lib/marketplace";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";
import type { AssistantCard, ToolExecutor, ToolOutcome } from "./assistant";

const searchInput = z.object({
  query: z.string().max(120).optional(),
  place: z.string().max(120).optional(),
  max_price: z.number().positive().max(100000).optional(),
  mode: z.enum(["on_site", "at_home", "online"]).optional(),
  availability: z.enum(["any", "today", "3d", "7d"]).optional(),
  sort: z.enum(["relevance", "distance", "availability", "price_asc", "rating"]).optional(),
});
const availabilityInput = z.object({ business_slug: z.string().min(3).max(60), service: z.string().max(120).optional(), date_from: z.string().optional() });
const handoffInput = z.object({ summary: z.string().max(1000) });

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: siteConfig.booking.timeZone }).format(new Date(iso));

async function search(raw: unknown, location: { lat: number; lng: number } | null): Promise<ToolOutcome> {
  const input = searchInput.parse(raw);
  let lat = location?.lat ?? null;
  let lng = location?.lng ?? null;
  if (input.place) {
    const geo = await geocodeAddress(input.place);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }
  }
  // Un métier reconnu filtre par catégorie ; sinon recherche plein texte (nom, prestation).
  const category = input.query ? matchCategories(input.query, 1)[0] : undefined;
  const exactCategory = category && normalizeText(input.query ?? "").length <= normalizeText(category.label).length + 3 ? category : undefined;
  const res = await searchBusinesses({
    q: exactCategory ? null : (input.query ?? null),
    category: exactCategory?.slug ?? null,
    lat,
    lng,
    maxPrice: input.max_price ?? null,
    mode: input.mode ?? null,
    availability: input.availability ?? "any",
    sort: input.sort,
  });
  const top = res.results.slice(0, 6);
  const cards: AssistantCard[] = top.map((r) => ({
    type: "business",
    name: r.name,
    category: getCategory(r.category)?.label ?? r.category,
    city: r.city,
    distanceKm: r.distance_km,
    priceFrom: r.min_price_eur === null ? null : Number(r.min_price_eur),
    rating: Number(r.rating_avg),
    ratingCount: r.rating_count,
    href: businessPath(r),
    nextSlot: r.nextSlotAt,
    sponsored: Boolean(r.sponsored),
  }));
  return {
    content: JSON.stringify({
      total: res.total,
      results: top.map((r) => ({
        slug: r.slug,
        name: r.name,
        category: getCategory(r.category)?.label,
        city: r.city,
        distance_km: r.distance_km === null ? null : Math.round(r.distance_km * 10) / 10,
        price_from_eur: r.min_price_eur,
        rating: r.rating_count ? `${Number(r.rating_avg).toFixed(1)}/5 (${r.rating_count} avis)` : "nouveau",
        next_slot: r.nextSlotAt ? fmtDate(r.nextSlotAt) : null,
        modes: r.modes,
      })),
    }),
    cards,
  };
}

async function availability(raw: unknown): Promise<ToolOutcome> {
  const input = availabilityInput.parse(raw);
  const business = await loadPublicBusiness(input.business_slug);
  if (!business) return { content: JSON.stringify({ error: "Établissement introuvable." }) };
  const catalog = await loadCatalog(business);
  const services = catalog.services.map((s) => ({ id: s.id, name: s.name, price_from_eur: Math.min(Number(s.price_eur), ...s.variants.map((v) => Number(v.price_eur))), duration_min: s.duration_minutes, variants: s.variants.map((v) => v.label) }));
  const wanted = input.service ? normalizeText(input.service) : "";
  const service = (wanted && catalog.services.find((s) => normalizeText(s.name).includes(wanted) || wanted.includes(normalizeText(s.name)))) || catalog.services[0];
  const path = businessPath(business);
  if (!service) return { content: JSON.stringify({ business: business.name, services, slots: [] }) };

  const today = zonedDateString(new Date(), siteConfig.booking.timeZone);
  const start = input.date_from && isValidDateString(input.date_from) && input.date_from >= today ? input.date_from : today;
  const variantKey = service.variants[0]?.key ?? null;
  const location = (service.modes.length ? service.modes : business.modes)[0] ?? "on_site";
  const duration = servicePrice(service, variantKey).duration_minutes + (location === "at_home" ? Number(business.travel_buffer_minutes) : 0);
  const staffIds = eligibleStaffIds(catalog.staff, service.id);
  const window = await computeSlotWindow({
    business,
    serviceId: service.id,
    capacity: service.capacity,
    durationMinutes: duration,
    staffIds,
    requestedStaffId: null,
    seats: 1,
    startDate: start,
    days: 7,
  });
  const days = window.days.filter((d) => d.slots.length).slice(0, 3);
  const card: AssistantCard = {
    type: "slots",
    businessName: business.name,
    serviceName: service.name,
    href: `${path}?service=${service.id}#reserver`,
    days: days.map((d) => ({ date: d.date, slots: d.slots.slice(0, 8).map((s) => ({ time: s.time, href: `${path}?service=${service.id}&date=${d.date}#reserver` })) })),
  };
  return {
    content: JSON.stringify({
      business: business.name,
      address: business.address,
      modes: business.modes,
      cancellation_hours: business.cancellation_hours,
      deposit: business.deposit_enabled && business.stripe_connect_onboarded ? `${business.deposit_percent} %` : "aucun",
      services,
      shown_service: service.name,
      slots: days.map((d) => ({ date: d.date, times: d.slots.slice(0, 8).map((s) => s.time) })),
      next_available_date: days.length ? null : window.nextAvailable,
      note: service.variants.length ? `Prix variable selon : ${getCategory(business.category)?.variantLabel ?? "option"}.` : undefined,
    }),
    cards: [card],
  };
}

async function myAppointments(userId: string | null): Promise<ToolOutcome> {
  if (!userId) return { content: JSON.stringify({ error: "Usager non connecté : proposer /login." }), cards: [{ type: "link", label: "Se connecter", href: "/login?next=/compte" }] };
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select("id, business_id, service_name, start_at, status")
    .eq("client_user_id", userId)
    .gte("start_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order("start_at")
    .limit(10)
    .returns<Pick<Booking, "id" | "business_id" | "service_name" | "start_at" | "status">[]>();
  const ids = Array.from(new Set((data ?? []).map((b) => b.business_id)));
  const { data: biz } = ids.length ? await admin.from("businesses").select("id, name").in("id", ids).returns<{ id: string; name: string }[]>() : { data: [] as { id: string; name: string }[] };
  const name = new Map((biz ?? []).map((b) => [b.id, b.name]));
  const list = (data ?? []).map((b) => ({ business: name.get(b.business_id) ?? "", service: b.service_name, when: fmtDate(b.start_at), status: b.status, start_at: b.start_at }));
  return {
    content: JSON.stringify({ appointments: list, manage: "/compte" }),
    cards: list.slice(0, 5).map((b) => ({ type: "appointment", businessName: b.business, serviceName: b.service, startAt: b.start_at, status: b.status, href: "/compte" })),
  };
}

async function handoff(raw: unknown, userId: string | null): Promise<ToolOutcome> {
  const { summary } = handoffInput.parse(raw);
  await createAdminClient().from("system_events").insert({ level: "warning", source: "assistant.handoff", message: summary.slice(0, 1000), context: { user_id: userId } });
  return {
    content: JSON.stringify({ ok: true, support_email: siteConfig.supportEmail, delay: "réponse humaine sous 24 h ouvrées" }),
    cards: [{ type: "link", label: `Écrire au support (${siteConfig.supportEmail})`, href: `mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent("Demande via l'assistant")}&body=${encodeURIComponent(summary)}` }],
  };
}

export const executeAssistantTool: ToolExecutor = async (name, input, ctx) => {
  switch (name) {
    case "search_businesses":
      return search(input, ctx.location);
    case "get_availability":
      return availability(input);
    case "get_my_appointments":
      return myAppointments(ctx.userId);
    case "handoff_to_human":
      return handoff(input, ctx.userId);
    default:
      return { content: JSON.stringify({ error: "outil inconnu" }) };
  }
};
