import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchPage, type RawParams } from "@/components/search/search-page";
import { getCategory } from "@/config/categories";
import { topCitiesForCategory } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

type Params = Promise<{ category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const cat = getCategory((await params).category);
  if (!cat) return {};
  return {
    title: `${cat.plural} : prenez rendez-vous en ligne`,
    description: `Trouvez un ${cat.label.toLowerCase()} près de chez vous, comparez prix, avis et disponibilités, et réservez en ligne 24 h/24.`,
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Promise<RawParams> }) {
  const [{ category }, sp] = await Promise.all([params, searchParams]);
  const cat = getCategory(category);
  if (!cat) notFound();
  const cities = await topCitiesForCategory(cat.slug).catch(() => []);
  return (
    <>
      <SearchPage
        params={sp}
        fixedCategory={cat.slug}
        basePath={`/${cat.slug}`}
        intro={cities.length ? undefined : `Réservez en ligne votre ${cat.label.toLowerCase()} : ${cat.keywords.slice(0, 4).join(", ")}…`}
      />
      {cities.length > 0 && (
        <section className="mx-auto -mt-8 max-w-7xl px-4 pb-10">
          <h2 className="mb-3 text-lg font-bold">{cat.plural} par ville</h2>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <Link key={c.city_slug} href={`/${cat.slug}/${c.city_slug}`} className="chip">
                {cat.label} à {c.city} <span className="text-ink-soft">({c.count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
