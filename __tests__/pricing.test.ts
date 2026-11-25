import { describe, expect, it } from "vitest";
import {
  computeQuote,
  computeTravelFee,
  depositCents,
  haversineKm,
  roadDistanceKm,
  servicePriceForSize,
  type ServiceForPricing,
  type StudioForPricing,
} from "@/lib/domain/pricing";

const studio: StudioForPricing = {
  free_radius_km: 15,
  max_radius_km: 45,
  price_per_extra_km: 1.2,
  travel_buffer_minutes: 30,
  deposit_enabled: true,
  deposit_percent: 30,
  stripe_connect_onboarded: true,
};

const service: ServiceForPricing = {
  base_price_eur: 89,
  base_duration_minutes: 120,
  size_pricing_json: {
    suv_4x4: { price_eur: 119, duration_minutes: 150 },
    utilitaire: { price_eur: 139.9, duration_minutes: 180 },
  },
};

describe("haversine", () => {
  it("Paris -> Lyon ≈ 392 km à vol d'oiseau", () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
    expect(d).toBeGreaterThan(388);
    expect(d).toBeLessThan(396);
  });

  it("applique le coefficient routier × 1,25", () => {
    const a = { lat: 48.8566, lng: 2.3522 };
    const b = { lat: 48.9, lng: 2.45 };
    expect(roadDistanceKm(a, b)).toBeCloseTo(Math.round(haversineKm(a, b) * 1.25 * 10) / 10, 5);
  });

  it("distance nulle pour un même point", () => {
    expect(haversineKm({ lat: 45, lng: 5 }, { lat: 45, lng: 5 })).toBe(0);
  });
});

describe("frais kilométriques", () => {
  it("gratuit dans le rayon offert", () => {
    expect(computeTravelFee(12, studio)).toEqual({ distanceKm: 12, feeCents: 0, outOfZone: false });
  });
  it("facture les km au-delà du rayon gratuit", () => {
    expect(computeTravelFee(25, studio).feeCents).toBe(1200);
    expect(computeTravelFee(15.5, studio).feeCents).toBe(60);
  });
  it("hors zone au-delà du rayon max", () => {
    expect(computeTravelFee(45.1, studio).outOfZone).toBe(true);
    expect(computeTravelFee(45, studio).outOfZone).toBe(false);
  });
});

describe("gabarit", () => {
  it("utilise le tarif spécifique au gabarit si défini", () => {
    expect(servicePriceForSize(service, "suv_4x4")).toEqual({ price_eur: 119, duration_minutes: 150 });
  });
  it("retombe sur le tarif de base sinon", () => {
    expect(servicePriceForSize(service, "citadine")).toEqual({ price_eur: 89, duration_minutes: 120 });
    expect(servicePriceForSize({ ...service, size_pricing_json: null }, "suv_4x4").price_eur).toBe(89);
  });
});

describe("devis complet", () => {
  it("atelier : prestation + options, sans tampon ni frais km", () => {
    const q = computeQuote({
      service,
      addons: [
        { price_eur: 25, duration_minutes: 30 },
        { price_eur: 14.5, duration_minutes: 15 },
      ],
      size: "berline",
      locationType: "workshop",
      distanceKm: null,
      studio,
    });
    expect(q.servicePriceCents).toBe(8900);
    expect(q.addonsCents).toBe(3950);
    expect(q.travelFeeCents).toBe(0);
    expect(q.totalCents).toBe(12850);
    expect(q.workMinutes).toBe(165);
    expect(q.blockedMinutes).toBe(165);
    expect(q.depositCents).toBe(3855);
  });

  it("domicile : frais km + tampon trajet bloqué dans l'agenda", () => {
    const q = computeQuote({
      service,
      addons: [],
      size: "utilitaire",
      locationType: "mobile",
      distanceKm: 20,
      studio,
    });
    expect(q.servicePriceCents).toBe(13990);
    expect(q.travelFeeCents).toBe(600);
    expect(q.totalCents).toBe(14590);
    expect(q.workMinutes).toBe(180);
    expect(q.blockedMinutes).toBe(210);
    expect(q.outOfZone).toBe(false);
  });

  it("domicile sans distance : erreur", () => {
    expect(() =>
      computeQuote({ service, addons: [], size: "citadine", locationType: "mobile", distanceKm: null, studio }),
    ).toThrow("DISTANCE_REQUIRED");
  });

  it("domicile hors zone signalé", () => {
    const q = computeQuote({ service, addons: [], size: "citadine", locationType: "mobile", distanceKm: 60, studio });
    expect(q.outOfZone).toBe(true);
  });
});

describe("acompte", () => {
  it("nul si acomptes désactivés ou Connect non activé", () => {
    expect(depositCents(10000, { ...studio, deposit_enabled: false })).toBe(0);
    expect(depositCents(10000, { ...studio, stripe_connect_onboarded: false })).toBe(0);
  });
  it("arrondi au centime", () => {
    expect(depositCents(9999, studio)).toBe(3000);
    expect(depositCents(10000, { ...studio, deposit_percent: 100 })).toBe(10000);
  });
});
