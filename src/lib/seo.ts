/**
 * Référencement Google et moteurs IA (AI Overviews, ChatGPT search, Claude, Perplexity, Copilot) :
 * données structurées schema.org exactes, construites uniquement à partir des données réelles.
 */
import { getCategory, type CategoryDef } from "@/config/categories";
import { siteConfig } from "@/config/site";
import type { OpeningHours } from "@/lib/domain/availability";
import { businessPath } from "@/lib/slug";
import type { PublicBusiness, Review, Service } from "@/lib/supabase/types";

export function absoluteUrl(path: string): string {
  return `${siteConfig.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Sous-type schema.org le plus précis pour chaque métier (LocalBusiness par défaut). */
const SCHEMA_TYPES: Record<string, string> = {
  coiffeur: "HairSalon", barbier: "HairSalon", "institut-de-beaute": "BeautySalon", onglerie: "NailSalon",
  "extensions-de-cils": "BeautySalon", maquilleur: "BeautySalon", tatoueur: "TattooParlor", massage: "DaySpa", spa: "DaySpa",
  sophrologue: "HealthAndBeautyBusiness", "coach-sportif": "SportsActivityLocation", "yoga-pilates": "SportsActivityLocation",
  "cours-de-danse": "SportsActivityLocation", garage: "AutoRepair", detailing: "AutoWash", carrosserie: "AutoBodyShop",
  "auto-ecole": "DrivingSchool", moto: "AutoRepair", plombier: "Plumber", electricien: "Electrician", serrurier: "Locksmith",
  menage: "HomeAndConstructionBusiness", jardinier: "HomeAndConstructionBusiness", demenageur: "MovingCompany",
  "artisan-renovation": "GeneralContractor", "depannage-informatique": "ProfessionalService", toilettage: "LocalBusiness",
  "educateur-canin": "LocalBusiness", "pet-sitter": "LocalBusiness", "soutien-scolaire": "ProfessionalService",
  "cours-de-musique": "ProfessionalService", "cours-de-langues": "ProfessionalService", "coach-de-vie": "ProfessionalService",
  avocat: "Attorney", notaire: "Notary", "expert-comptable": "AccountingService", "agent-immobilier": "RealEstateAgent",
  "assurance-banque": "InsuranceAgency", restaurant: "Restaurant", "escape-game": "EntertainmentBusiness",
  photographe: "ProfessionalService", "atelier-creatif": "EntertainmentBusiness", "retouches-couture": "LocalBusiness",
  conciergerie: "ProfessionalService",
};

export function schemaTypeFor(category: string): string {
  return SCHEMA_TYPES[category] ?? "LocalBusiness";
}

const DAY_URIS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Horaires schema.org (pause déjeuner = deux plages). */
export function openingHoursSpecification(hours: OpeningHours[]) {
  const specs: { "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string; closes: string }[] = [];
  for (const h of hours) {
    if (h.is_closed || !h.open_time || !h.close_time) continue;
    const day = `https://schema.org/${DAY_URIS[h.day_of_week]}`;
    const t = (v: string) => v.slice(0, 5);
    if (h.break_start && h.break_end) {
      specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens: t(h.open_time), closes: t(h.break_start) });
      specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens: t(h.break_end), closes: t(h.close_time) });
    } else {
      specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens: t(h.open_time), closes: t(h.close_time) });
    }
  }
  return specs;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function businessJsonLd(b: PublicBusiness, services: Service[], hours: OpeningHours[], reviews: Review[]) {
  const url = absoluteUrl(businessPath(b));
  const cat = getCategory(b.category);
  return {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(b.category),
    "@id": `${url}#business`,
    name: b.name,
    description: b.tagline ?? b.description ?? `${cat?.label ?? "Professionnel"} à ${b.city ?? ""} — réservation en ligne sur ${siteConfig.name}.`,
    url,
    ...(b.cover_url ? { image: b.cover_url } : { image: absoluteUrl(`${businessPath(b)}/opengraph-image`) }),
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(b.website ? { sameAs: [b.website] } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: b.address ?? undefined,
      postalCode: b.postal_code ?? undefined,
      addressLocality: b.city ?? undefined,
      addressCountry: "FR",
    },
    ...(b.lat !== null && b.lng !== null ? { geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } } : {}),
    ...(b.modes.includes("at_home") && b.lat !== null && b.lng !== null
      ? { areaServed: { "@type": "GeoCircle", geoMidpoint: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng }, geoRadius: `${Number(b.max_radius_km) * 1000}` } }
      : {}),
    ...(b.min_price_eur !== null ? { priceRange: `À partir de ${Number(b.min_price_eur)} €` } : {}),
    ...(b.payment_methods.length ? { paymentAccepted: b.payment_methods.join(", ") } : {}),
    currenciesAccepted: "EUR",
    openingHoursSpecification: openingHoursSpecification(hours),
    ...(b.rating_count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(b.rating_avg), reviewCount: b.rating_count, bestRating: 5, worstRating: 1 } }
      : {}),
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author_name },
      datePublished: r.created_at.slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      ...(r.comment ? { reviewBody: r.comment } : {}),
    })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Prestations",
      itemListElement: services.map((s) => {
        const prices = [Number(s.price_eur), ...s.variants.map((v) => Number(v.price_eur))];
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name, ...(s.description ? { description: s.description } : {}) },
          priceCurrency: "EUR",
          ...(min === max ? { price: min } : { priceSpecification: { "@type": "PriceSpecification", minPrice: min, maxPrice: max, priceCurrency: "EUR" } }),
          availability: "https://schema.org/InStock",
          url: `${url}?service=${s.id}#reserver`,
        };
      }),
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: `${url}#reserver`, inLanguage: "fr", actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"] },
      result: { "@type": "Reservation", name: `Rendez-vous chez ${b.name}` },
    },
  };
}

export interface ListedBusiness {
  name: string;
  path: string;
  rating_avg: number;
  rating_count: number;
  min_price_eur: number | null;
  city: string | null;
}

export function itemListJsonLd(name: string, items: ListedBusiness[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(b.path), name: b.name })),
  };
}

export interface CategoryStats {
  businesses: number;
  min_price: number | null;
  avg_price: number | null;
  avg_rating: number | null;
  reviews: number;
  at_home: number;
  online: number;
  cities: number;
}

/** FAQ factuelle (chiffres réels uniquement) pour une page métier ou métier × ville. */
export function categoryFaq(cat: CategoryDef, stats: CategoryStats, cityLabel: string | null): { question: string; answer: string }[] {
  const where = cityLabel ? ` à ${cityLabel}` : "";
  const label = cat.label.toLowerCase();
  const faq: { question: string; answer: string }[] = [
    {
      question: `Comment prendre rendez-vous avec un ${label}${where} ?`,
      answer: `Choisissez un établissement sur ${siteConfig.name}, sélectionnez la prestation puis un créneau libre affiché en temps réel : la réservation est confirmée immédiatement par email, avec rappel la veille. C'est gratuit et sans création de compte obligatoire.`,
    },
  ];
  if (stats.businesses > 0 && stats.min_price !== null) {
    faq.push({
      question: `Combien coûte un ${label}${where} ?`,
      answer: `Sur ${siteConfig.name}, les prestations de ${stats.businesses} ${stats.businesses > 1 ? cat.plural.toLowerCase() : label}${where} commencent à ${Number(stats.min_price)} €${stats.avg_price !== null ? `, pour un prix d'entrée moyen de ${Number(stats.avg_price)} €` : ""}. Le prix exact s'affiche avant de réserver${cat.variantLabel ? ` et dépend de : ${cat.variantLabel.toLowerCase()}` : ""}.`,
    });
  }
  if (stats.at_home > 0) {
    faq.push({
      question: `Existe-t-il des ${cat.plural.toLowerCase()} qui se déplacent à domicile${where} ?`,
      answer: `Oui : ${stats.at_home} établissement${stats.at_home > 1 ? "s" : ""} propose${stats.at_home > 1 ? "nt" : ""} l'intervention à domicile. Les frais de déplacement éventuels sont calculés automatiquement à partir de votre adresse avant la réservation.`,
    });
  }
  if (stats.online > 0) {
    faq.push({ question: `Peut-on faire la séance en visio ?`, answer: `Oui, ${stats.online} établissement${stats.online > 1 ? "s" : ""} propose${stats.online > 1 ? "nt" : ""} des rendez-vous en visio. Filtrez par « En visio » dans les résultats.` });
  }
  if (stats.reviews > 0 && stats.avg_rating !== null) {
    faq.push({
      question: `Les avis sont-ils fiables ?`,
      answer: `Oui : seuls les clients venus à leur rendez-vous peuvent laisser un avis. Les ${label}s${where} sont notés ${Number(stats.avg_rating).toFixed(1).replace(".", ",")}/5 en moyenne sur ${stats.reviews} avis vérifiés.`,
    });
  }
  faq.push({
    question: `Peut-on annuler ou déplacer son rendez-vous ?`,
    answer: `Oui, depuis « Mes rendez-vous » ou le lien reçu par email, selon la politique d'annulation de l'établissement affichée sur sa page.`,
  });
  return faq;
}

export function faqJsonLd(faq: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${absoluteUrl("/")}#organization`,
      name: siteConfig.name,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icons/512"),
      email: siteConfig.supportEmail,
      description: `${siteConfig.name} : la plateforme de prise de rendez-vous en ligne pour tous les métiers (hors santé) — coiffeurs, garages, coachs, avocats, restaurants, artisans…`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: siteConfig.name,
      url: absoluteUrl("/"),
      inLanguage: "fr-FR",
      publisher: { "@id": `${absoluteUrl("/")}#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/recherche")}?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** Sérialisation sûre dans une balise <script> (échappe « < »). */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
