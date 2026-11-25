import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { proPriceCents, seatsFor, stripeTiers, yearlySavingsCents } from "@/lib/domain/plans";

describe("tarification Pro par agenda", () => {
  it("1 agenda inclus, puis prix unitaire", () => {
    expect(proPriceCents(1, "month")).toBe(3900);
    expect(proPriceCents(4, "month")).toBe(3900 + 3 * 1500);
    expect(proPriceCents(0, "month")).toBe(3900);
  });
  it("annuel = 10 mois payés (2 mois offerts)", () => {
    expect(proPriceCents(1, "year")).toBe(39000);
    expect(yearlySavingsCents(1)).toBe(3900 * 2);
    expect(yearlySavingsCents(3)).toBe(proPriceCents(3, "month") * 2);
  });
  it("paliers Stripe cohérents avec le calcul affiché", () => {
    const [first, rest] = stripeTiers("month");
    expect(first).toMatchObject({ up_to: 1, flat_amount: 3900, unit_amount: 0 });
    expect(rest).toMatchObject({ up_to: "inf", unit_amount: 1500 });
    for (const n of [1, 2, 7]) expect((first?.flat_amount ?? 0) + Math.max(0, n - 1) * (rest?.unit_amount ?? 0)).toBe(proPriceCents(n, "month"));
  });
  it("au moins un siège, commission désactivée par défaut", () => {
    expect(seatsFor(-3)).toBe(1);
    expect(siteConfig.pricing.newClientCommissionPercent).toBe(0);
  });
});
