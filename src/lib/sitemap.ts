import "server-only";
import { CATEGORIES } from "@/config/categories";
import { absoluteUrl } from "@/lib/seo";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

export const BUSINESSES_PER_SITEMAP = 40_000;

export interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: number;
}

const xmlEscape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function urlset(entries: UrlEntry[]): string {
  const body = entries
    .map((e) => `<url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority !== undefined ? `<priority>${e.priority.toFixed(1)}</priority>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapIndex(locs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((l) => `<sitemap><loc>${xmlEscape(l)}</loc></sitemap>`).join("")}</sitemapindex>`;
}

export async function countPublishedBusinesses(): Promise<number> {
  const { count } = await createAdminClient().from("businesses").select("id", { count: "exact", head: true }).eq("published", true).not("min_price_eur", "is", null);
  return count ?? 0;
}

export function staticEntries(): UrlEntry[] {
  return [
    { loc: absoluteUrl("/"), changefreq: "daily", priority: 1 },
    { loc: absoluteUrl("/pro"), changefreq: "weekly", priority: 0.8 },
    { loc: absoluteUrl("/pro/inscription"), changefreq: "monthly", priority: 0.6 },
    { loc: absoluteUrl("/cgu"), changefreq: "monthly", priority: 0.2 },
    { loc: absoluteUrl("/confidentialite"), changefreq: "monthly", priority: 0.2 },
    { loc: absoluteUrl("/mentions-legales"), changefreq: "monthly", priority: 0.2 },
    ...CATEGORIES.map((c) => ({ loc: absoluteUrl(`/${c.slug}`), changefreq: "daily" as const, priority: 0.9 })),
  ];
}

/** Toutes les combinaisons métier × ville où au moins un établissement est publié. */
export async function categoryCityEntries(): Promise<UrlEntry[]> {
  const { data } = await createAdminClient()
    .from("businesses")
    .select("category, city_slug, updated_at")
    .eq("published", true)
    .not("min_price_eur", "is", null)
    .not("city_slug", "is", null)
    .limit(200_000)
    .returns<{ category: string; city_slug: string; updated_at: string }[]>();
  const latest = new Map<string, string>();
  for (const r of data ?? []) {
    const key = `/${r.category}/${r.city_slug}`;
    if (!latest.has(key) || (latest.get(key) ?? "") < r.updated_at) latest.set(key, r.updated_at);
  }
  return [...latest.entries()].map(([path, lastmod]) => ({ loc: absoluteUrl(path), lastmod: lastmod.slice(0, 10), changefreq: "daily", priority: 0.8 }));
}

export async function businessEntries(page: number): Promise<UrlEntry[]> {
  const from = page * BUSINESSES_PER_SITEMAP;
  const { data } = await createAdminClient()
    .from("businesses")
    .select("slug, category, city_slug, updated_at")
    .eq("published", true)
    .not("min_price_eur", "is", null)
    .order("created_at")
    .range(from, from + BUSINESSES_PER_SITEMAP - 1)
    .returns<{ slug: string; category: string; city_slug: string | null; updated_at: string }[]>();
  return (data ?? []).map((b) => ({ loc: absoluteUrl(businessPath(b)), lastmod: b.updated_at.slice(0, 10), changefreq: "daily", priority: 0.7 }));
}
