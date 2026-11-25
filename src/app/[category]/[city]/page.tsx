import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchPage, type RawParams } from "@/components/search/search-page";
import { getCategory } from "@/config/categories";
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
    description: `Les meilleurs ${cat.plural.toLowerCase()} à ${label} : prix, avis, disponibilités en temps réel. Réservez en ligne 24 h/24.`,
  };
}

export default async function CategoryCityPage({ params, searchParams }: { params: Params; searchParams: Promise<RawParams> }) {
  const [{ category, city }, sp] = await Promise.all([params, searchParams]);
  const cat = getCategory(category);
  if (!cat || !/^[a-z0-9-]{2,60}$/.test(city)) notFound();
  const label = await cityLabel(city).catch(() => city);
  return <SearchPage params={sp} fixedCategory={cat.slug} fixedCity={{ slug: city, label }} basePath={`/${cat.slug}/${city}`} />;
}
