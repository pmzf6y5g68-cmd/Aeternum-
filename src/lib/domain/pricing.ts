/**
 * Moteur de tarification pur : gabarit + options + frais kilométriques + acompte.
 * Tous les montants sortants sont en centimes (entiers) pour éviter les erreurs d'arrondi.
 */
export const VEHICLE_SIZES = ["citadine", "berline", "suv_4x4", "utilitaire"] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];

export type LocationType = "workshop" | "mobile";
export type ServiceMode = "workshop" | "mobile" | "both";

export const ROAD_FACTOR = 1.25;

export interface SizePricing {
  price_eur: number;
  duration_minutes: number;
}
export type SizePricingMap = Partial<Record<VehicleSize, SizePricing>>;

export interface ServiceForPricing {
  base_price_eur: number;
  base_duration_minutes: number;
  size_pricing_json: SizePricingMap | null;
}

export interface AddonForPricing {
  price_eur: number;
  duration_minutes: number;
}

export interface StudioForPricing {
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
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
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

export function computeTravelFee(distanceKm: number, studio: StudioForPricing): TravelFee {
  const distance = Math.max(0, distanceKm);
  if (distance > Number(studio.max_radius_km)) {
    return { distanceKm: distance, feeCents: 0, outOfZone: true };
  }
  const extraKm = Math.max(0, distance - Number(studio.free_radius_km));
  return {
    distanceKm: distance,
    feeCents: Math.round(extraKm * Number(studio.price_per_extra_km) * 100),
    outOfZone: false,
  };
}

export function servicePriceForSize(service: ServiceForPricing, size: VehicleSize): SizePricing {
  const override = service.size_pricing_json?.[size];
  if (override && Number.isFinite(override.price_eur) && Number.isFinite(override.duration_minutes)) {
    return { price_eur: Number(override.price_eur), duration_minutes: Math.round(Number(override.duration_minutes)) };
  }
  return { price_eur: Number(service.base_price_eur), duration_minutes: Math.round(Number(service.base_duration_minutes)) };
}

export function depositCents(totalCents: number, studio: StudioForPricing): number {
  if (!studio.deposit_enabled || !studio.stripe_connect_onboarded) return 0;
  const pct = Math.min(100, Math.max(0, Number(studio.deposit_percent)));
  return Math.round((totalCents * pct) / 100);
}

export interface QuoteInput {
  service: ServiceForPricing;
  addons: AddonForPricing[];
  size: VehicleSize;
  locationType: LocationType;
  /** Distance routière en km (obligatoire si locationType = mobile). */
  distanceKm: number | null;
  studio: StudioForPricing;
}

export interface Quote {
  servicePriceCents: number;
  addonsCents: number;
  travelFeeCents: number;
  totalCents: number;
  depositCents: number;
  /** Durée de la prestation elle-même. */
  workMinutes: number;
  /** Durée bloquée dans l'agenda (prestation + tampon trajet si domicile). */
  blockedMinutes: number;
  distanceKm: number | null;
  outOfZone: boolean;
}

export function computeQuote(input: QuoteInput): Quote {
  const base = servicePriceForSize(input.service, input.size);
  const servicePriceCents = eurToCents(base.price_eur);
  const addonsCents = input.addons.reduce((sum, a) => sum + eurToCents(a.price_eur), 0);
  const addonsMinutes = input.addons.reduce((sum, a) => sum + Math.max(0, Math.round(Number(a.duration_minutes))), 0);
  const workMinutes = base.duration_minutes + addonsMinutes;

  let travelFeeCents = 0;
  let outOfZone = false;
  let distanceKm: number | null = null;
  let blockedMinutes = workMinutes;

  if (input.locationType === "mobile") {
    if (input.distanceKm === null || !Number.isFinite(input.distanceKm)) {
      throw new Error("DISTANCE_REQUIRED");
    }
    const travel = computeTravelFee(input.distanceKm, input.studio);
    travelFeeCents = travel.feeCents;
    outOfZone = travel.outOfZone;
    distanceKm = travel.distanceKm;
    blockedMinutes = workMinutes + Math.max(0, Math.round(Number(input.studio.travel_buffer_minutes)));
  }

  const totalCents = servicePriceCents + addonsCents + travelFeeCents;
  return {
    servicePriceCents,
    addonsCents,
    travelFeeCents,
    totalCents,
    depositCents: depositCents(totalCents, input.studio),
    workMinutes,
    blockedMinutes,
    distanceKm,
    outOfZone,
  };
}
