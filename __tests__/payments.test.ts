import { describe, expect, it } from "vitest";
import { formatGiftCode, isGiftCode } from "@/lib/domain/gift-code";
import { computeQuote, noShowFeeCents, type BusinessForPricing } from "@/lib/domain/pricing";

const base: BusinessForPricing = {
  free_radius_km: 10, max_radius_km: 30, price_per_extra_km: 1, travel_buffer_minutes: 30,
  deposit_enabled: false, deposit_percent: 30, stripe_connect_onboarded: true, card_guarantee: true, no_show_fee_percent: 50,
};
const service = { price_eur: 60, duration_minutes: 60, variants: [] };

describe("empreinte bancaire", () => {
  it("frais d'absence = pourcentage du total", () => {
    expect(noShowFeeCents(6000, base)).toBe(3000);
    expect(computeQuote({ service, addons: [], locationType: "on_site", distanceKm: null, business: base }).guaranteeFeeCents).toBe(3000);
  });

  it("jamais cumulée avec un acompte, ni sans Connect, ni sous 1 €", () => {
    expect(noShowFeeCents(6000, { ...base, deposit_enabled: true })).toBe(0);
    expect(noShowFeeCents(6000, { ...base, stripe_connect_onboarded: false })).toBe(0);
    expect(noShowFeeCents(6000, { ...base, card_guarantee: false })).toBe(0);
    expect(noShowFeeCents(150, { ...base, no_show_fee_percent: 10 })).toBe(0);
  });

  it("pourcentage borné entre 10 et 100 %", () => {
    expect(noShowFeeCents(6000, { ...base, no_show_fee_percent: 500 })).toBe(6000);
    expect(noShowFeeCents(6000, { ...base, no_show_fee_percent: 1 })).toBe(600);
  });
});

describe("cartes cadeaux", () => {
  it("normalise la saisie du code", () => {
    expect(formatGiftCode(" abcd efgh-jkmn ")).toBe("ABCD-EFGH-JKMN");
    expect(isGiftCode("ABCD-EFGH-JKMN")).toBe(true);
    expect(isGiftCode("ABCD-EFGH")).toBe(false);
  });
});
