import { describe, expect, it } from "vitest";
import { getCategory } from "@/config/categories";
import { businessJsonLd, categoryFaq, jsonLdScript, openingHoursSpecification, schemaTypeFor } from "@/lib/seo";
import { sitemapIndex, urlset } from "@/lib/sitemap";
import type { PublicBusiness, Service } from "@/lib/supabase/types";

const biz = {
  id: "b1", slug: "salon-elegance", name: "Salon Élégance", category: "coiffeur", tagline: null, description: null, phone: "0400000000",
  website: null, address: "1 rue de la République, 69001 Lyon", postal_code: "69001", city: "Lyon", city_slug: "lyon", lat: 45.76, lng: 4.83,
  modes: ["on_site", "at_home"], cover_url: null, highlights: [], payment_methods: ["Carte bancaire"], free_radius_km: 10, max_radius_km: 30,
  price_per_extra_km: 1, travel_buffer_minutes: 30, slot_step_minutes: 30, min_lead_minutes: 120, max_days_ahead: 60, cancellation_hours: 24,
  deposit_enabled: false, deposit_percent: 30, plan: "pro", stripe_connect_onboarded: false, min_price_eur: 40, rating_avg: 4.6, rating_count: 12,
  published: true, locale: "fr", card_guarantee_enabled: false, no_show_fee_percent: 50, gift_cards_enabled: false,
} as PublicBusiness;
const service = { id: "s1", business_id: "b1", name: "Coupe", description: null, price_eur: 45, duration_minutes: 60, variants: [{ key: "l", label: "Longs", price_eur: 63, duration_minutes: 80 }], capacity: 1, modes: [], active: true, sort: 0 } as Service;

describe("données structurées", () => {
  it("type schema.org précis par métier", () => {
    expect(schemaTypeFor("coiffeur")).toBe("HairSalon");
    expect(schemaTypeFor("garage")).toBe("AutoRepair");
    expect(schemaTypeFor("avocat")).toBe("Attorney");
    expect(schemaTypeFor("inconnu")).toBe("LocalBusiness");
  });

  it("horaires avec pause = deux plages", () => {
    const spec = openingHoursSpecification([{ day_of_week: 1, open_time: "09:00:00", close_time: "19:00:00", break_start: "12:30:00", break_end: "13:30:00", is_closed: false }, { day_of_week: 0, open_time: null, close_time: null, break_start: null, break_end: null, is_closed: true }]);
    expect(spec).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "09:00", closes: "12:30" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "13:30", closes: "19:00" },
    ]);
  });

  it("fiche : note, offres à fourchette de prix, zone à domicile, action de réservation", () => {
    const ld = businessJsonLd(biz, [service], [], []) as Record<string, unknown> & { hasOfferCatalog: { itemListElement: Record<string, unknown>[] } };
    expect(ld["@type"]).toBe("HairSalon");
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.6, reviewCount: 12 });
    expect(ld.hasOfferCatalog.itemListElement[0]).toMatchObject({ priceSpecification: { minPrice: 45, maxPrice: 63 } });
    expect(ld.areaServed).toMatchObject({ "@type": "GeoCircle", geoRadius: "30000" });
    expect(ld.potentialAction).toMatchObject({ "@type": "ReserveAction" });
  });

  it("pas de note publiée sans avis", () => {
    expect(businessJsonLd({ ...biz, rating_count: 0 }, [], [], []).aggregateRating).toBeUndefined();
  });

  it("FAQ : uniquement des chiffres réels", () => {
    const cat = getCategory("coiffeur")!;
    const empty = categoryFaq(cat, { businesses: 0, min_price: null, avg_price: null, avg_rating: null, reviews: 0, at_home: 0, online: 0, cities: 0 }, "Lyon");
    expect(empty.some((f) => f.question.startsWith("Combien"))).toBe(false);
    const full = categoryFaq(cat, { businesses: 12, min_price: 18, avg_price: 41, avg_rating: 4.7, reviews: 300, at_home: 3, online: 0, cities: 1 }, "Lyon");
    expect(full.find((f) => f.question.startsWith("Combien"))?.answer).toContain("18 €");
    expect(full.some((f) => f.question.includes("domicile"))).toBe(true);
    expect(full.some((f) => f.question.includes("visio"))).toBe(false);
  });

  it("échappement JSON-LD et XML", () => {
    expect(jsonLdScript({ a: "</script><script>x" })).not.toContain("</script>");
    expect(urlset([{ loc: "https://x.fr/a?b=1&c=2" }])).toContain("a?b=1&amp;c=2");
    expect(sitemapIndex(["https://x.fr/s/1.xml"])).toContain("<sitemapindex");
  });
});
