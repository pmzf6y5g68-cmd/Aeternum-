/**
 * Moteur de tarification pur et universel : prestation + variante (gabarit, longueur, taille,
 * nombre de personnes…) + options + places + frais kilométriques + acompte.
 * Tous les montants sortants sont en centimes (entiers).
 */
import type { LocationMode } from "@/config/categories";

export const ROAD_FACTOR = 1.25;

export interface Variant {
  key: string;
  label: string;
  price_eur: number;
  duration_minutes: number;
}

export interface ServiceForPricing {
  price_eur: number;
  duration_minutes: number;
  variants: Variant[] | null;
}

export interface AddonForPricing {
  price_eur: number;
  duration_minutes: number;
}

export interface BusinessForPricing {
  free_radius_km: number;
  max_radius_km: number;
  price_per_extra_km: number;
  travel_buffer_minutes: number;
  deposit_enabled: boolean;
  deposit_percent: number;
  stripe_connect_onboarded: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function eurToCents(eur: number): number {
  return Math.round(Number(eur) * 100);
}

export function centsToEur(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatEur(cents: number, locale: string = "fr-FR"): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: whole ? 0 : 2 }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Distance orthodromique (km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimation de la distance routière : Haversine × 1,25, arrondie à 0,1 km. */
export function roadDistanceKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * ROAD_FACTOR * 10) / 10;
}

export interface TravelFee {
  distanceKm: number;
  feeCents: number;
  outOfZone: boolean;
}

export function computeTravelFee(distanceKm: number, business: BusinessForPricing): TravelFee {
  const distance = Math.max(0, distanceKm);
  if (distance > Number(business.max_radius_km)) return { distanceKm: distance, feeCents: 0, outOfZone: true };
  const extraKm = Math.max(0, distance - Number(business.free_radius_km));
  return { distanceKm: distance, feeCents: Math.round(extraKm * Number(business.price_per_extra_km) * 100), outOfZone: false };
}

/** Variante choisie, ou tarif de base si la prestation n'a pas de variante. */
export function resolveVariant(service: ServiceForPricing, variantKey: string | null | undefined): Variant | null {
  const variants = service.variants ?? [];
  if (variants.length === 0) return null;
  const found = variants.find((v) => v.key === variantKey);
  if (!found) throw new Error("VARIANT_REQUIRED");
  return found;
}

export function servicePrice(service: ServiceForPricing, variantKey?: string | null): { price_eur: number; duration_minutes: number } {
  const variant = resolveVariant(service, variantKey);
  return variant
    ? { price_eur: Number(variant.price_eur), duration_minutes: Math.round(Number(variant.duration_minutes)) }
    : { price_eur: Number(service.price_eur), duration_minutes: Math.round(Number(service.duration_minutes)) };
}

/** Prix « à partir de » affiché dans les listes. */
export function startingPriceCents(service: ServiceForPricing): number {
  const prices = [Number(service.price_eur), ...(service.variants ?? []).map((v) => Number(v.price_eur))];
  return eurToCents(Math.min(...prices));
}

export function depositCents(totalCents: number, business: BusinessForPricing): number {
  if (!business.deposit_enabled || !business.stripe_connect_onboarded) return 0;
  const pct = Math.min(100, Math.max(0, Number(business.deposit_percent)));
  return Math.round((totalCents * pct) / 100);
}

export interface QuoteInput {
  service: ServiceForPricing;
  variantKey?: string | null;
  addons: AddonForPricing[];
  /** Nombre de places (cours collectif, table…). Le prix unitaire est multiplié, pas la durée. */
  seats?: number;
  locationType: LocationMode;
  /** Distance routière en km (obligatoire si locationType = at_home). */
  distanceKm: number | null;
  business: BusinessForPricing;
}

export interface Quote {
  unitPriceCents: number;
  addonsCents: number;
  seats: number;
  travelFeeCents: number;
  totalCents: number;
  depositCents: number;
  /** Durée de la prestation elle-même. */
  workMinutes: number;
  /** Durée bloquée dans l'agenda (prestation + tampon trajet si à domicile). */
  blockedMinutes: number;
  distanceKm: number | null;
  outOfZone: boolean;
  variant: Variant | null;
}

export function computeQuote(input: QuoteInput): Quote {
  const variant = resolveVariant(input.service, input.variantKey);
  const base = servicePrice(input.service, input.variantKey);
  const seats = Math.max(1, Math.round(input.seats ?? 1));
  const unitPriceCents = eurToCents(base.price_eur);
  const addonsCents = input.addons.reduce((sum, a) => sum + eurToCents(a.price_eur), 0);
  const addonsMinutes = input.addons.reduce((sum, a) => sum + Math.max(0, Math.round(Number(a.duration_minutes))), 0);
  const workMinutes = base.duration_minutes + addonsMinutes;

  let travelFeeCents = 0;
  let outOfZone = false;
  let distanceKm: number | null = null;
  let blockedMinutes = workMinutes;

  if (input.locationType === "at_home") {
    if (input.distanceKm === null || !Number.isFinite(input.distanceKm)) throw new Error("DISTANCE_REQUIRED");
    const travel = computeTravelFee(input.distanceKm, input.business);
    travelFeeCents = travel.feeCents;
    outOfZone = travel.outOfZone;
    distanceKm = travel.distanceKm;
    blockedMinutes = workMinutes + Math.max(0, Math.round(Number(input.business.travel_buffer_minutes)));
  }

  const totalCents = (unitPriceCents + addonsCents) * seats + travelFeeCents;
  return {
    unitPriceCents,
    addonsCents,
    seats,
    travelFeeCents,
    totalCents,
    depositCents: depositCents(totalCents, input.business),
    workMinutes,
    blockedMinutes,
    distanceKm,
    outOfZone,
    variant,
  };
}
