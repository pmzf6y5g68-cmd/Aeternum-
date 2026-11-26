import { describe, expect, it } from "vitest";
import { e164 } from "@/lib/domain/phone";

describe("téléphone E.164 (flux Google)", () => {
  it("normalise les numéros français", () => {
    expect(e164("06 12 34 56 78")).toBe("+33612345678");
    expect(e164("+33 4 78 00 00 00")).toBe("+33478000000");
    expect(e164("04.78.00.00.00")).toBe("+33478000000");
  });
  it("refuse l'invalide", () => {
    expect(e164("12")).toBeNull();
    expect(e164(null)).toBeNull();
  });
});
