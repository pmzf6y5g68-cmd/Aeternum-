import { describe, expect, it } from "vitest";
import { CATEGORIES, GROUPS, getCategory, matchCategories } from "@/config/categories";
import { buildSeedHours, buildSeedServices, roundDuration, roundPrice } from "@/lib/catalog";
import { businessPath, businessSlug, slugify } from "@/lib/slug";

describe("catalogue des métiers", () => {
  it("slugs uniques, groupes valides, aucune catégorie médicale", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const groups = new Set(GROUPS.map((g) => g.slug));
    expect(CATEGORIES.every((c) => groups.has(c.group) && c.seed.length >= 3 && c.modes.length >= 1)).toBe(true);
    expect(slugs.some((s) => /medecin|dentiste|kine|osteo|psy|infirm|veterin/.test(s))).toBe(false);
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(40);
  });

  it("autocomplétion par libellé et mots-clés, sans accents", () => {
    expect(matchCategories("coif")[0]?.slug).toBe("coiffeur");
    expect(matchCategories("vidange")[0]?.slug).toBe("garage");
    expect(matchCategories("pedicure").length).toBeGreaterThanOrEqual(0);
    expect(matchCategories("électri")[0]?.slug).toBe("electricien");
    expect(matchCategories("a")).toEqual([]);
  });

  it("variantes générées depuis les facteurs de la catégorie", () => {
    const services = buildSeedServices(getCategory("coiffeur")!);
    const first = services[0]!;
    expect(first.variants.map((v) => v.key)).toEqual(["courts", "mi-longs", "longs"]);
    expect(first.variants[2]).toMatchObject({ price_eur: 63, duration_minutes: 80 });
    expect(buildSeedServices(getCategory("avocat")!)[0]?.variants).toEqual([]);
    expect(buildSeedServices(getCategory("yoga-pilates")!)[0]?.capacity).toBe(12);
  });

  it("arrondis commerciaux", () => {
    expect(roundPrice(63.4)).toBe(63);
    expect(roundPrice(226.8)).toBe(225);
    expect(roundDuration(67)).toBe(65);
    expect(roundDuration(1)).toBe(5);
  });

  it("horaires par univers", () => {
    const resto = buildSeedHours(getCategory("restaurant")!);
    expect(resto.find((h) => h.day_of_week === 1)?.is_closed).toBe(true);
    expect(resto.find((h) => h.day_of_week === 5)).toMatchObject({ open_time: "12:00", break_start: "14:30" });
    expect(buildSeedHours(getCategory("coiffeur")!).find((h) => h.day_of_week === 0)?.is_closed).toBe(true);
  });

  it("slugs et URL canoniques", () => {
    expect(slugify("Salon Élégance & Co")).toBe("salon-elegance-co");
    expect(businessSlug("Coiffeur", "Lyon")).toBe("coiffeur-lyon");
    expect(businessSlug("Pro", "Lyon")).toBe("pro-lyon");
    expect(businessPath({ category: "barbier", city_slug: "lyon", slug: "le-barbier" })).toBe("/barbier/lyon/le-barbier");
  });
});
