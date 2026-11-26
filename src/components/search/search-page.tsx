import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { getCategory } from "@/config/categories";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { geocodeAddress } from "@/lib/domain/geocode";
import { AVAILABILITY_FILTERS, SORTS, searchBusinesses, type AvailabilityFilter, type SortKey } from "@/lib/marketplace";
import { businessPath } from "@/lib/slug";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { FiltersBar } from "./filters-bar";
import { ResultsView } from "./results-view";
import type { SerializedResult } from "./types";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo";

export type RawParams = Record<string, string | string[] | undefined>;

function one(p: RawParams, key: string): string | undefined {
  const v = p[key];
  return Array.isArray(v) ? v[0] : v;
}

function num(p: RawParams, key: string): number | null {
  const v = Number(one(p, key));
  return Number.isFinite(v) && one(p, key) !== undefined && one(p, key) !== "" ? v : null;
}

export interface SearchPageProps {
  params: RawParams;
  fixedCategory?: string;
  fixedCity?: { slug: string; label: string };
  title?: string;
  intro?: string;
  basePath: string;
  /** Pages métier / ville indexables : FAQ factuelle + données structurées. */
  seo?: { faq: { question: string; answer: string }[]; breadcrumbs: { name: string; path: string }[]; listName: string };
}

export async function SearchPage({ params, fixedCategory, fixedCity, title, intro, basePath, seo }: SearchPageProps) {
  const q = one(params, "q")?.slice(0, 100) ?? "";
  const category = fixedCategory ?? getCategory(one(params, "categorie"))?.slug ?? null;
  let lat = num(params, "lat");
  let lng = num(params, "lng");
  let placeLabel = one(params, "ou")?.slice(0, 120) ?? "";
  if ((lat === null || lng === null) && placeLabel) {
    const geo = await geocodeAddress(placeLabel);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      placeLabel = geo.city ?? geo.label;
    }
  }
  const sortRaw = one(params, "tri");
  const availRaw = one(params, "dispo");
  const modeRaw = one(params, "mode");
  const page = Math.max(1, Math.floor(num(params, "page") ?? 1));

  const response = await searchBusinesses({
    q: category && !q ? null : q,
    category,
    citySlug: fixedCity && lat === null ? fixedCity.slug : null,
    lat,
    lng,
    radiusKm: num(params, "rayon"),
    maxPrice: num(params, "prix_max"),
    mode: modeRaw === "on_site" || modeRaw === "at_home" || modeRaw === "online" ? modeRaw : null,
    minRating: num(params, "note"),
    availability: (AVAILABILITY_FILTERS as readonly string[]).includes(availRaw ?? "") ? (availRaw as AvailabilityFilter) : "any",
    sort: (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SortKey) : undefined,
    page,
  }).catch(() => ({ results: [], total: 0, page: 1, pageCount: 1 }));

  const results: SerializedResult[] = response.results.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    tagline: r.tagline,
    address: r.address,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    modes: r.modes,
    cover_url: r.cover_url,
    min_price_eur: r.min_price_eur === null ? null : Number(r.min_price_eur),
    rating_avg: Number(r.rating_avg),
    rating_count: r.rating_count,
    distance_km: r.distance_km,
    path: businessPath(r),
    sponsored: Boolean(r.sponsored),
    nextSlotAt: r.nextSlotAt,
    preview: r.preview.map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ time: s.time, startAt: s.startAt })) })),
  }));

  const cat = getCategory(category);
  const heading =
    title ??
    [cat ? cat.plural : q ? `« ${q} »` : fr.search.title, placeLabel && lat !== null ? format(fr.search.near, { place: placeLabel }) : fixedCity ? `à ${fixedCity.label}` : ""]
      .filter(Boolean)
      .join(" ");
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const value = Array.isArray(v) ? v[0] : v;
      if (value && k !== "page") sp.set(k, value);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <>
      <SiteHeader
        variant="white"
        search={{
          defaultQuery: q,
          defaultCategory: category,
          defaultPlace: lat !== null && lng !== null && placeLabel ? { label: placeLabel, lat, lng } : null,
          defaultPlaceLabel: fixedCity?.label ?? placeLabel,
        }}
      />
      {seo && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript([
              breadcrumbJsonLd(seo.breadcrumbs),
              itemListJsonLd(seo.listName, results.map((r) => ({ name: r.name, path: r.path, rating_avg: r.rating_avg, rating_count: r.rating_count, min_price_eur: r.min_price_eur, city: r.city }))),
              faqJsonLd(seo.faq),
            ]),
          }}
        />
      )}
      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className="mb-4 space-y-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{heading}</h1>
            <p className="text-sm text-ink-soft tabular-nums">{response.total === 0 ? "Aucun établissement pour l'instant" : `${response.total.toLocaleString("fr-FR")} établissement${response.total > 1 ? "s" : ""}`}</p>
            {intro && <p className="mt-2 max-w-3xl text-sm text-ink-soft">{intro}</p>}
          </div>
          <Suspense>
            <FiltersBar showCategory={!fixedCategory} />
          </Suspense>
        </div>

        {results.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <SearchX className="size-10 text-ink-soft" aria-hidden />
            <p className="max-w-md text-ink-soft">{fr.search.noResults}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/recherche" className="btn-primary">
                Effacer les filtres
              </Link>
              <Link href="/" className="btn-secondary">
                Voir ce qu&apos;il y a autour de moi
              </Link>
            </div>
          </div>
        ) : (
          <ResultsView results={results} center={lat !== null && lng !== null ? { lat, lng } : null} radiusKm={num(params, "rayon")} />
        )}

        {response.pageCount > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3">
            {response.page > 1 && (
              <Link href={pageHref(response.page - 1)} className="btn-secondary">
                <ChevronLeft className="size-4" aria-hidden /> {fr.search.previous}
              </Link>
            )}
            <span className="text-sm text-ink-soft">
              {response.page} / {response.pageCount}
            </span>
            {response.page < response.pageCount && (
              <Link href={pageHref(response.page + 1)} className="btn-secondary">
                {fr.search.nextPage} <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        )}
        {seo && seo.faq.length > 0 && (
          <section className="mt-10 max-w-3xl">
            <h2 className="mb-3 text-xl font-bold">Questions fréquentes</h2>
            <div className="space-y-2">
              {seo.faq.map((f) => (
                <details key={f.question} className="card p-4">
                  <summary className="cursor-pointer font-semibold">{f.question}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
