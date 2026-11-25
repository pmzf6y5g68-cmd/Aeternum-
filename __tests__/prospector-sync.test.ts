import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_BY_SLUG } from "@/config/categories";

describe("robot de prospection", () => {
  const source = readFileSync(new URL("../scripts/prospector.py", import.meta.url), "utf8");
  const slugs = Array.from(source.matchAll(/\{"slug": "([a-z0-9-]+)"/g), (m) => m[1]);

  it("ne prospecte que des métiers existants du catalogue", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(40);
    expect(slugs.filter((s) => !CATEGORY_BY_SLUG.has(s ?? ""))).toEqual([]);
  });

  it("couvre tout le catalogue", () => {
    expect([...CATEGORY_BY_SLUG.keys()].filter((s) => !slugs.includes(s))).toEqual([]);
  });
});
