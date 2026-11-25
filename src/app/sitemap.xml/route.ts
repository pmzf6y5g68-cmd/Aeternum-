import { absoluteUrl } from "@/lib/seo";
import { BUSINESSES_PER_SITEMAP, countPublishedBusinesses, sitemapIndex } from "@/lib/sitemap";

export const revalidate = 3600;

/** Index de sitemaps : pages fixes + métiers, métier × ville, puis fiches par lots de 40 000. */
export async function GET() {
  const total = await countPublishedBusinesses().catch(() => 0);
  const parts = ["static", "villes", ...Array.from({ length: Math.max(1, Math.ceil(total / BUSINESSES_PER_SITEMAP)) }, (_, i) => `etablissements-${i}`)];
  return new Response(sitemapIndex(parts.map((p) => absoluteUrl(`/sitemaps/${p}.xml`))), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
