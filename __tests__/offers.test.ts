import { describe, expect, it } from "vitest";
import { discountedCents, maxOfferPercent, slotDiscountPercent, type OfferRules } from "@/lib/domain/offers";

const tz = "Europe/Paris";
const rules: OfferRules = { offpeak_percent: 20, offpeak_days: [2, 3], offpeak_start: "14:00", offpeak_end: "17:00", lastminute_percent: 30, lastminute_hours: 6 };
const now = new Date("2026-11-30T08:00:00Z"); // lundi 9h Paris

describe("offres heures creuses / dernière minute", () => {
  it("heures creuses : bon jour et bonne plage", () => {
    expect(slotDiscountPercent(new Date("2026-12-01T14:00:00Z"), now, rules, tz)).toBe(20); // mardi 15h
    expect(slotDiscountPercent(new Date("2026-12-01T16:00:00Z"), now, rules, tz)).toBe(0); // mardi 17h : fin exclue
    expect(slotDiscountPercent(new Date("2026-12-04T14:00:00Z"), now, rules, tz)).toBe(0); // vendredi
  });
  it("dernière minute dans la fenêtre, et jamais cumulée : la plus forte gagne", () => {
    expect(slotDiscountPercent(new Date("2026-11-30T12:00:00Z"), now, rules, tz)).toBe(30); // dans 4 h
    expect(slotDiscountPercent(new Date("2026-11-30T16:00:00Z"), now, rules, tz)).toBe(0); // dans 8 h
    const both = { ...rules, offpeak_days: [1], offpeak_start: "09:00", offpeak_end: "18:00" };
    expect(slotDiscountPercent(new Date("2026-11-30T10:00:00Z"), now, both, tz)).toBe(30);
  });
  it("plafond à 50 % et badge", () => {
    expect(slotDiscountPercent(new Date("2026-11-30T09:00:00Z"), now, { ...rules, lastminute_percent: 90 }, tz)).toBe(50);
    expect(maxOfferPercent(rules)).toBe(30);
    expect(maxOfferPercent({ ...rules, lastminute_percent: 0, offpeak_days: [] })).toBe(0);
  });
  it("prix remisé lisible", () => {
    expect(discountedCents(4500, 20)).toBe(3600);
    expect(discountedCents(4990, 15)).toBe(4200);
    expect(discountedCents(4500, 0)).toBe(4500);
  });
});

import { loyaltyDiscountPercent, visitsUntilReward } from "@/lib/domain/offers";
import { computeQuote } from "@/lib/domain/pricing";

describe("fidélité et carnets", () => {
  it("10e visite remisée, pas avant, et de nouveau à la 20e", () => {
    expect(loyaltyDiscountPercent(8, 10, 50)).toBe(0);
    expect(loyaltyDiscountPercent(9, 10, 50)).toBe(50);
    expect(loyaltyDiscountPercent(19, 10, 50)).toBe(50);
    expect(loyaltyDiscountPercent(9, 0, 50)).toBe(0);
    expect(visitsUntilReward(9, 10)).toBe(0);
    expect(visitsUntilReward(3, 10)).toBe(6);
  });
  it("séance couverte par un carnet : la prestation ne coûte plus rien, les options restent dues", () => {
    const service = { price_eur: 40, duration_minutes: 60, variants: [] };
    const business = { deposit_enabled: false, deposit_percent: 30, stripe_connect_onboarded: false, free_radius_km: 0, max_radius_km: 0, price_per_extra_km: 0, travel_buffer_minutes: 0, card_guarantee_enabled: false, no_show_fee_percent: 50 };
    const q = computeQuote({ service, variantKey: null, addons: [{ price_eur: 5, duration_minutes: 10 }], seats: 1, locationType: "on_site", distanceKm: null, business, coveredByPack: true } as never);
    expect(q.totalCents).toBe(500);
  });
});
