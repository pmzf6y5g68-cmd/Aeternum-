import "server-only";
import { z } from "zod";
import { CATEGORIES, getCategory, matchCategories, normalizeText } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { geocodeAddress } from "@/lib/domain/geocode";
import { openState } from "@/lib/domain/opening";
import { servicePrice } from "@/lib/domain/pricing";
import { openingHoursText } from "@/lib/seo";
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
const nearbyInput = z.object({ place: z.string().max(120).optional(), radius_km: z.number().min(1).max(200).optional() });
const detailsInput = z.object({ business_slug: z.string().min(3).max(60) });
const pricesInput = z.object({ category: z.string().min(2).max(60), city: z.string().max(80).optional() });

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

async function resolvePosition(place: string | undefined, location: { lat: number; lng: number } | null) {
  if (place) {
    const geo = await geocodeAddress(place);
    if (geo) return { lat: geo.lat, lng: geo.lng };
  }
  return location;
}

interface NearbyRow {
  slug: string;
  name: string;
  category: string;
  city: string | null;
  city_slug: string | null;
  min_price_eur: number | null;
  rating_avg: number;
  rating_count: number;
  plan: string;
  distance_km: number;
}

/** Les plus proches dans CHAQUE métier, n'importe où (lecture directe de la base, toujours à jour). */
async function nearbyEverything(raw: unknown, location: { lat: number; lng: number } | null): Promise<ToolOutcome> {
  const input = nearbyInput.parse(raw);
  const pos = await resolvePosition(input.place, location);
  if (!pos) return { content: JSON.stringify({ error: "Position inconnue : demander la ville ou proposer « Partager ma position »." }) };
  const { data, error } = await createAdminClient().rpc("nearby_by_category", { p_lat: pos.lat, p_lng: pos.lng, p_radius_km: input.radius_km ?? 25, p_per_category: 2 });
  if (error) throw error;
  const rows = (data ?? []) as NearbyRow[];
  const byCat = new Map<string, NearbyRow[]>();
  for (const r of rows) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  const groups = [...byCat.entries()]
    .map(([slug, list]) => {
      const items = list.sort((a, b) => a.distance_km - b.distance_km);
      return { category: getCategory(slug)?.label ?? slug, first: items[0] as NearbyRow, items };
    })
    .sort((a, b) => a.first.distance_km - b.first.distance_km);
  const missing = CATEGORIES.filter((c) => !byCat.has(c.slug)).map((c) => c.label);
  return {
    content: JSON.stringify({
      radius_km: input.radius_km ?? 25,
      domains: groups.map((g) => ({
        category: g.category,
        nearest: g.items.map((r) => ({ slug: r.slug, name: r.name, distance_km: Math.round(r.distance_km * 10) / 10, price_from_eur: r.min_price_eur, rating: r.rating_count ? `${Number(r.rating_avg).toFixed(1)}/5 (${r.rating_count})` : "nouveau" })),
      })),
      no_business_yet_within_radius: missing,
    }),
    cards: groups.slice(0, 8).map((g) => {
      const r = g.first;
      return { type: "business", name: r.name, category: g.category, city: r.city, distanceKm: r.distance_km, priceFrom: r.min_price_eur === null ? null : Number(r.min_price_eur), rating: Number(r.rating_avg), ratingCount: r.rating_count, href: businessPath(r), nextSlot: null, sponsored: false } satisfies AssistantCard;
    }),
  };
}

/** Fiche complète : horaires, ouvert maintenant, prestations, équipe, avis récents, conditions. */
async function businessDetails(raw: unknown): Promise<ToolOutcome> {
  const { business_slug } = detailsInput.parse(raw);
  const b = await loadPublicBusiness(business_slug);
  if (!b) return { content: JSON.stringify({ error: "Établissement introuvable." }) };
  const [catalog, { data: packRows }] = await Promise.all([
    loadCatalog(b),
    createAdminClient().from("packs").select("name, sessions, price_eur").eq("business_id", b.id).eq("active", true).returns<{ name: string; sessions: number; price_eur: number }[]>(),
  ]);
  const packs = b.stripe_connect_onboarded ? (packRows ?? []) : [];
  const now = openState(catalog.hours, new Date(), siteConfig.booking.timeZone);
  const path = businessPath(b);
  return {
    content: JSON.stringify({
      name: b.name,
      category: getCategory(b.category)?.label,
      tagline: b.tagline,
      description: b.description?.slice(0, 900),
      address: [b.address, b.postal_code, b.city].filter(Boolean).join(", "),
      phone: b.phone,
      open_now: now.label,
      opening_hours: openingHoursText(catalog.hours),
      modes: b.modes,
      highlights: b.highlights,
      payment_methods: b.payment_methods,
      rating: b.rating_count ? `${Number(b.rating_avg).toFixed(1)}/5 sur ${b.rating_count} avis vérifiés` : "pas encore d'avis",
      services: catalog.services.slice(0, 25).map((s) => ({ name: s.name, price_from_eur: Math.min(Number(s.price_eur), ...s.variants.map((v) => Number(v.price_eur))), duration_min: s.duration_minutes })),
      team: catalog.staff.map((s) => [s.name, s.title].filter(Boolean).join(" — ")),
      recent_reviews: catalog.reviews.slice(0, 6).map((r) => ({ rating: r.rating, comment: r.comment?.slice(0, 280) ?? null, owner_reply: r.reply ? r.reply.slice(0, 200) : null })),
      conditions: {
        free_cancellation_until_hours_before: b.cancellation_hours,
        deposit: b.deposit_enabled && b.stripe_connect_onboarded ? `${b.deposit_percent} % à la réservation` : "aucun",
        card_guarantee: b.card_guarantee_enabled && b.stripe_connect_onboarded ? `empreinte bancaire, frais d'absence ${b.no_show_fee_percent} %` : "non",
        at_home_travel: b.modes.includes("at_home") ? { free_radius_km: b.free_radius_km, max_radius_km: b.max_radius_km, price_per_extra_km_eur: b.price_per_extra_km } : null,
      },
      offers: {
        off_peak: b.offpeak_percent > 0 && b.offpeak_start && b.offpeak_end && b.offpeak_days.length ? { percent: b.offpeak_percent, weekdays_0_sunday: b.offpeak_days, from: b.offpeak_start.slice(0, 5), to: b.offpeak_end.slice(0, 5) } : null,
        last_minute: b.lastminute_percent > 0 ? { percent: b.lastminute_percent, within_hours: b.lastminute_hours } : null,
        loyalty: b.loyalty_every >= 2 && b.loyalty_percent > 0 ? { every_n_visits: b.loyalty_every, percent: b.loyalty_percent } : null,
        note: "Remises fixées par l'établissement, appliquées automatiquement au créneau concerné (les créneaux remisés portent un badge).",
      },
      packs: packs.map((p) => ({ name: p.name, sessions: p.sessions, price_eur: p.price_eur, buy: `/carnet/${b.slug}` })),
      gift_cards: b.gift_cards_enabled && b.stripe_connect_onboarded ? `/carte-cadeau/${b.slug}` : null,
      page: path,
    }),
    cards: [
      { type: "link", label: `Voir la fiche de ${b.name}`, href: path },
      { type: "link", label: "Choisir un créneau", href: `${path}#reserver` },
    ],
  };
}

/** Repères de prix d'un métier (dans une ville ou partout), calculés en direct. */
async function priceOverview(raw: unknown): Promise<ToolOutcome> {
  const input = pricesInput.parse(raw);
  const cat = getCategory(input.category) ?? matchCategories(input.category, 1)[0];
  if (!cat) return { content: JSON.stringify({ error: "Métier non reconnu sur Rendez-vous." }) };
  const citySlug = input.city ? normalizeText(input.city).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null;
  const { data } = await createAdminClient().rpc("category_stats", { p_category: cat.slug, p_city_slug: citySlug }).single<{ businesses: number; min_price: number | null; avg_price: number | null; avg_rating: number | null; reviews: number; at_home: number; online: number; cities: number }>();
  return {
    content: JSON.stringify({ category: cat.label, city: input.city ?? "toute la plateforme", ...(data ?? { businesses: 0 }) }),
    cards: [{ type: "link", label: `Voir les ${cat.label.toLowerCase()}s${input.city ? ` à ${input.city}` : ""}`, href: `/recherche?categorie=${cat.slug}${input.city ? `&ou=${encodeURIComponent(input.city)}` : ""}` }],
  };
}

async function myFavorites(userId: string | null): Promise<ToolOutcome> {
  if (!userId) return { content: JSON.stringify({ error: "Usager non connecté." }), cards: [{ type: "link", label: "Se connecter", href: "/login?next=/compte" }] };
  const admin = createAdminClient();
  const { data: favs } = await admin.from("favorites").select("business_id").eq("user_id", userId).limit(20).returns<{ business_id: string }[]>();
  const ids = (favs ?? []).map((f) => f.business_id);
  const { data: biz } = ids.length
    ? await admin.from("businesses").select("slug, name, category, city, city_slug, min_price_eur, rating_avg, rating_count").in("id", ids).eq("published", true).returns<Omit<NearbyRow, "distance_km" | "plan">[]>()
    : { data: [] as Omit<NearbyRow, "distance_km" | "plan">[] };
  const list = biz ?? [];
  return {
    content: JSON.stringify({ favorites: list.map((b) => ({ slug: b.slug, name: b.name, category: getCategory(b.category)?.label, city: b.city })) }),
    cards: list.slice(0, 6).map((b) => ({ type: "business", name: b.name, category: getCategory(b.category)?.label ?? b.category, city: b.city, distanceKm: null, priceFrom: b.min_price_eur === null ? null : Number(b.min_price_eur), rating: Number(b.rating_avg), ratingCount: b.rating_count, href: businessPath(b), nextSlot: null, sponsored: false })),
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
    case "nearby_everything":
      return nearbyEverything(input, ctx.location);
    case "get_business_details":
      return businessDetails(input);
    case "price_overview":
      return priceOverview(input);
    case "get_my_favorites":
      return myFavorites(ctx.userId);
    default:
      return { content: JSON.stringify({ error: "outil inconnu" }) };
  }
};
