import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchPage, type RawParams } from "@/components/search/search-page";
import { getCategory } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { loadCategoryStats } from "@/lib/marketplace";
import { categoryFaq } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ category: string; city: string }>;

async function cityLabel(slug: string): Promise<string> {
  const { data } = await createAdminClient().from("businesses").select("city").eq("city_slug", slug).limit(1).maybeSingle<{ city: string | null }>();
  return data?.city ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, city } = await params;
  const cat = getCategory(category);
  if (!cat) return {};
  const label = await cityLabel(city).catch(() => city);
  return {
    title: `${cat.plural} à ${label} : rendez-vous en ligne`,
    description: `${cat.plural} à ${label} : comparez prix, avis vérifiés et disponibilités en temps réel. Réservez en ligne 24 h/24, gratuitement.`,
    alternates: { canonical: `/${cat.slug}/${city}` },
    openGraph: { title: `${cat.plural} à ${label}`, url: `/${cat.slug}/${city}` },
  };
}

export default async function CategoryCityPage({ params, searchParams }: { params: Params; searchParams: Promise<RawParams> }) {
  const [{ category, city }, sp] = await Promise.all([params, searchParams]);
  const cat = getCategory(category);
  if (!cat || !/^[a-z0-9-]{2,60}$/.test(city)) notFound();
  const [label, stats] = await Promise.all([
    cityLabel(city).catch(() => city),
    loadCategoryStats(cat.slug, city),
  ]);
  return (
    <SearchPage
      params={sp}
      fixedCategory={cat.slug}
      fixedCity={{ slug: city, label }}
      basePath={`/${cat.slug}/${city}`}
      seo={{
        faq: stats ? categoryFaq(cat, stats, label) : [],
        listName: `${cat.plural} à ${label}`,
        breadcrumbs: [
          { name: siteConfig.name, path: "/" },
          { name: cat.plural, path: `/${cat.slug}` },
          { name: `${cat.plural} à ${label}`, path: `/${cat.slug}/${city}` },
        ],
      }}
    />
  );
}
