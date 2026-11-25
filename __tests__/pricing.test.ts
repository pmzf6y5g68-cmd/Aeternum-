import { describe, expect, it } from "vitest";
import {
  computeQuote,
  computeTravelFee,
  depositCents,
  formatDuration,
  formatEur,
  haversineKm,
  resolveVariant,
  roadDistanceKm,
  startingPriceCents,
  type BusinessForPricing,
  type ServiceForPricing,
} from "@/lib/domain/pricing";

const business: BusinessForPricing = {
  free_radius_km: 10,
  max_radius_km: 30,
  price_per_extra_km: 1,
  travel_buffer_minutes: 30,
  deposit_enabled: true,
  deposit_percent: 30,
  stripe_connect_onboarded: true,
};

const haircut: ServiceForPricing = {
  price_eur: 45,
  duration_minutes: 60,
  variants: [
    { key: "courts", label: "Cheveux courts", price_eur: 45, duration_minutes: 60 },
    { key: "longs", label: "Cheveux longs", price_eur: 63, duration_minutes: 80 },
  ],
};
const simple: ServiceForPricing = { price_eur: 90, duration_minutes: 30, variants: [] };

describe("distances", () => {
  it("Paris -> Lyon ≈ 392 km à vol d'oiseau", () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
    expect(d).toBeGreaterThan(388);
    expect(d).toBeLessThan(396);
  });
  it("coefficient routier × 1,25", () => {
    const a = { lat: 48.8566, lng: 2.3522 };
    const b = { lat: 48.9, lng: 2.45 };
    expect(roadDistanceKm(a, b)).toBeCloseTo(Math.round(haversineKm(a, b) * 1.25 * 10) / 10, 5);
  });
  it("frais km au-delà du rayon gratuit, hors zone au-delà du max", () => {
    expect(computeTravelFee(8, business).feeCents).toBe(0);
    expect(computeTravelFee(22.5, business).feeCents).toBe(1250);
    expect(computeTravelFee(30.1, business).outOfZone).toBe(true);
  });
});

describe("variantes", () => {
  it("résout la variante choisie", () => {
    expect(resolveVariant(haircut, "longs")?.price_eur).toBe(63);
  });
  it("exige une variante quand la prestation en a", () => {
    expect(() => resolveVariant(haircut, null)).toThrow("VARIANT_REQUIRED");
    expect(() => resolveVariant(haircut, "inconnue")).toThrow("VARIANT_REQUIRED");
  });
  it("aucune variante : tarif de base", () => {
    expect(resolveVariant(simple, null)).toBeNull();
  });
  it("prix « à partir de »", () => {
    expect(startingPriceCents(haircut)).toBe(4500);
    expect(startingPriceCents({ price_eur: 80, duration_minutes: 60, variants: [{ key: "a", label: "A", price_eur: 60, duration_minutes: 50 }] })).toBe(6000);
  });
});

describe("devis", () => {
  it("sur place : variante + options", () => {
    const q = computeQuote({ service: haircut, variantKey: "longs", addons: [{ price_eur: 15, duration_minutes: 15 }], locationType: "on_site", distanceKm: null, business });
    expect(q.unitPriceCents).toBe(6300);
    expect(q.totalCents).toBe(7800);
    expect(q.workMinutes).toBe(95);
    expect(q.blockedMinutes).toBe(95);
    expect(q.depositCents).toBe(2340);
    expect(q.variant?.label).toBe("Cheveux longs");
  });
  it("à domicile : frais km + tampon trajet", () => {
    const q = computeQuote({ service: simple, addons: [], locationType: "at_home", distanceKm: 15, business });
    expect(q.travelFeeCents).toBe(500);
    expect(q.totalCents).toBe(9500);
    expect(q.blockedMinutes).toBe(60);
  });
  it("en visio : ni frais ni tampon", () => {
    const q = computeQuote({ service: simple, addons: [], locationType: "online", distanceKm: null, business });
    expect(q.travelFeeCents).toBe(0);
    expect(q.blockedMinutes).toBe(30);
  });
  it("places multiples : prix × places, durée inchangée", () => {
    const yoga: ServiceForPricing = { price_eur: 18, duration_minutes: 60, variants: [] };
    const q = computeQuote({ service: yoga, addons: [], seats: 3, locationType: "on_site", distanceKm: null, business: { ...business, deposit_enabled: false } });
    expect(q.totalCents).toBe(5400);
    expect(q.workMinutes).toBe(60);
    expect(q.depositCents).toBe(0);
  });
  it("à domicile sans distance : erreur", () => {
    expect(() => computeQuote({ service: simple, addons: [], locationType: "at_home", distanceKm: null, business })).toThrow("DISTANCE_REQUIRED");
  });
  it("prestation gratuite (table de restaurant)", () => {
    const q = computeQuote({ service: { price_eur: 0, duration_minutes: 90, variants: [] }, addons: [], locationType: "on_site", distanceKm: null, business });
    expect(q.totalCents).toBe(0);
    expect(q.depositCents).toBe(0);
  });
});

describe("acompte & formats", () => {
  it("acompte nul sans Connect", () => {
    expect(depositCents(10000, { ...business, stripe_connect_onboarded: false })).toBe(0);
  });
  it("formats", () => {
    expect(formatEur(4500).replace(/\s/g, " ")).toBe("45 €");
    expect(formatEur(4550).replace(/\s/g, " ")).toBe("45,50 €");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1 h 30");
    expect(formatDuration(120)).toBe("2 h");
  });
});
