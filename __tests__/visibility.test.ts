import { describe, expect, it } from "vitest";
import { businessFaq, openingHoursText } from "@/lib/seo";
import { conversionRate, visibilityChecks, visibilityScore } from "@/lib/visibility";
import type { PublicBusiness, Service } from "@/lib/supabase/types";

const hours = [
  { day_of_week: 1, open_time: "09:00:00", close_time: "19:00:00", break_start: "12:30:00", break_end: "13:30:00", is_closed: false },
  { day_of_week: 6, open_time: "09:00:00", close_time: "17:00:00", break_start: null, break_end: null, is_closed: false },
];
const empty = {
  tagline: null, description: null, cover_url: null, phone: null, website: null, lat: null, lng: null, highlights: [], payment_methods: [],
  rating_count: 0, stripe_connect_onboarded: false, deposit_enabled: false, published: false,
};

describe("score de visibilité", () => {
  it("fiche vide = 0, fiche complète = 100", () => {
    expect(visibilityScore(visibilityChecks({ business: empty, services: [], hours: [] }))).toBe(0);
    const full = {
      ...empty, tagline: "Spécialiste du balayage naturel", description: "x".repeat(320), cover_url: "https://x/y.jpg", phone: "0400", website: "https://a.fr",
      lat: 45, lng: 4, highlights: ["Parking", "PMR"], payment_methods: ["CB"], rating_count: 7, stripe_connect_onboarded: true, deposit_enabled: true, published: true,
    };
    const services = Array.from({ length: 3 }, () => ({ description: "Une description suffisamment longue", active: true }));
    const checks = visibilityChecks({ business: full, services, hours });
    expect(checks.reduce((s, c) => s + c.points, 0)).toBe(100);
    expect(visibilityScore(checks)).toBe(100);
  });

  it("conversion vues -> réservations", () => {
    expect(conversionRate({ views: 0, widgetViews: 0, bookings: 0 })).toBeNull();
    expect(conversionRate({ views: 180, widgetViews: 20, bookings: 9 })).toBe(4.5);
  });
});

describe("FAQ de fiche", () => {
  const biz = {
    name: "Salon Élégance", category: "coiffeur", city: "Lyon", address: "1 rue de la République, 69001 Lyon", modes: ["on_site", "at_home"],
    max_radius_km: 20, free_radius_km: 5, payment_methods: ["Carte bancaire"], deposit_enabled: true, stripe_connect_onboarded: true, deposit_percent: 30,
    cancellation_hours: 24, rating_avg: 4.6, rating_count: 12,
  } as unknown as PublicBusiness;
  const services = [
    { name: "Coupe", price_eur: 45, duration_minutes: 60, variants: [{ key: "l", label: "Longs", price_eur: 63, duration_minutes: 80 }], active: true },
    { name: "Brushing", price_eur: 25, duration_minutes: 30, variants: [], active: true },
  ] as unknown as Service[];

  it("répond avec les vraies données", () => {
    const faq = businessFaq(biz, services, hours);
    const byQ = (start: string) => faq.find((f) => f.question.startsWith(start))?.answer ?? "";
    expect(byQ("Quels sont les tarifs")).toContain("Coupe : à partir de 45 € (60 min)");
    expect(byQ("Quels sont les tarifs")).toContain("Brushing : 25 € (30 min)");
    expect(byQ("Quels sont les horaires")).toContain("lundi : 09h00–12h30, 13h30–19h00");
    expect(byQ("Où se trouve")).toContain("jusqu'à 20 km");
    expect(byQ("Quels moyens")).toContain("acompte de 30 %");
    expect(byQ("Peut-on annuler")).toContain("24 h");
    expect(byQ("Quel est l'avis")).toContain("4,6/5 sur 12 avis");
  });

  it("horaires en clair, jours fermés inclus", () => {
    expect(openingHoursText(hours)).toContain("dimanche : fermé");
  });
});
