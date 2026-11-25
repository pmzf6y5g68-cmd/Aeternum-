import { describe, expect, it } from "vitest";
import { commissionCents } from "@/lib/domain/commission";

const base = { plan: "free" as const, source: "marketplace" as const, isNewClient: true, totalCents: 6000, percent: 20, capEur: 20 };

describe("commission nouveau client marketplace", () => {
  it("20 % du premier RDV d'un nouveau client venu de la marketplace", () => {
    expect(commissionCents(base)).toBe(1200);
  });
  it("plafonnée", () => {
    expect(commissionCents({ ...base, totalCents: 50000 })).toBe(2000);
  });
  it("jamais en Pro, sur un client fidèle, via le lien du pro, ou si gratuit", () => {
    expect(commissionCents({ ...base, plan: "pro" })).toBe(0);
    expect(commissionCents({ ...base, isNewClient: false })).toBe(0);
    expect(commissionCents({ ...base, source: "direct" })).toBe(0);
    expect(commissionCents({ ...base, totalCents: 0 })).toBe(0);
  });
  it("l'assistant IA compte comme la marketplace", () => {
    expect(commissionCents({ ...base, source: "assistant" })).toBe(1200);
  });
});
