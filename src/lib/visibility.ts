/**
 * Score de visibilité d'une fiche (0–100) : ce que Google, Google Maps et les moteurs IA
 * utilisent pour choisir quels établissements montrer et citer. Chaque critère manquant
 * devient une action concrète dans l'espace pro.
 */
import type { OpeningHours } from "@/lib/domain/availability";
import type { Business, Service } from "@/lib/supabase/types";

export interface VisibilityCheck {
  key: string;
  label: string;
  hint: string;
  points: number;
  done: boolean;
  href: string;
}

export interface VisibilityInput {
  business: Pick<
    Business,
    "tagline" | "description" | "cover_url" | "photos" | "phone" | "website" | "lat" | "lng" | "highlights" | "payment_methods" | "rating_count" | "stripe_connect_onboarded" | "deposit_enabled" | "published"
  >;
  services: Pick<Service, "description" | "active">[];
  hours: OpeningHours[];
}

export function visibilityChecks({ business: b, services, hours }: VisibilityInput): VisibilityCheck[] {
  const active = services.filter((s) => s.active);
  const described = active.filter((s) => (s.description ?? "").trim().length >= 20).length;
  return [
    { key: "published", label: "Page publiée", hint: "Sans publication, ni Google ni la recherche ne vous montrent.", points: 10, done: b.published, href: "/pro/ma-page" },
    { key: "description", label: "Présentation détaillée (300 caractères et plus)", hint: "Le texte que les IA résument pour vous recommander. Utilisez la rédaction IA.", points: 15, done: (b.description ?? "").trim().length >= 300, href: "/pro/visibilite#ia" },
    { key: "tagline", label: "Accroche", hint: "Affichée dans les résultats : c'est elle qui donne envie de cliquer.", points: 5, done: (b.tagline ?? "").trim().length >= 20, href: "/pro/ma-page" },
    { key: "photo", label: "Au moins 3 photos", hint: "Les clients choisissent d'abord avec les yeux : le lieu, l'équipe, un résultat.", points: 10, done: (b.photos?.length ?? 0) >= 3, href: "/pro/ma-page" },
    { key: "services", label: "Au moins 3 prestations décrites", hint: "Chaque prestation décrite est une recherche de plus où vous apparaissez.", points: 15, done: active.length >= 3 && described >= Math.min(3, active.length), href: "/pro/prestations" },
    { key: "hours", label: "Horaires renseignés", hint: "Répond aux questions « ouvert le samedi ? » de Google et des assistants.", points: 10, done: hours.some((h) => !h.is_closed && h.open_time), href: "/pro/horaires" },
    { key: "location", label: "Adresse géolocalisée", hint: "Indispensable pour les recherches « près de moi ».", points: 10, done: b.lat !== null && b.lng !== null, href: "/pro/ma-page" },
    { key: "contact", label: "Téléphone et site web", hint: "Signaux de confiance repris dans les données structurées.", points: 5, done: Boolean(b.phone) && Boolean(b.website), href: "/pro/ma-page" },
    { key: "details", label: "Points forts et moyens de paiement", hint: "Parking, accès PMR, CB… : les détails que les clients demandent aux IA.", points: 5, done: b.highlights.length >= 2 && b.payment_methods.length >= 1, href: "/pro/ma-page" },
    { key: "reviews", label: "5 avis vérifiés ou plus", hint: "Les avis font monter dans le classement et dans Google. Partagez votre lien après chaque RDV.", points: 10, done: b.rating_count >= 5, href: "/pro/avis" },
    { key: "deposit", label: "Paiement en ligne activé", hint: "Acompte en 1 clic : moins d'absences, badge « Paiement en ligne ».", points: 5, done: b.stripe_connect_onboarded && b.deposit_enabled, href: "/pro/abonnement" },
  ];
}

export function visibilityScore(checks: VisibilityCheck[]): number {
  const total = checks.reduce((sum, c) => sum + c.points, 0);
  const done = checks.reduce((sum, c) => sum + (c.done ? c.points : 0), 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export interface PeriodStats {
  views: number;
  widgetViews: number;
  bookings: number;
  marketplaceBookings: number;
  revenueEur: number;
}

/** Taux de conversion vues -> réservations, en pourcentage arrondi à 0,1. */
export function conversionRate(stats: Pick<PeriodStats, "views" | "widgetViews" | "bookings">): number | null {
  const views = stats.views + stats.widgetViews;
  if (views === 0) return null;
  return Math.round((stats.bookings / views) * 1000) / 10;
}
