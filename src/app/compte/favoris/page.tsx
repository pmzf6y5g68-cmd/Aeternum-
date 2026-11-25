import Link from "next/link";
import { BusinessAvatar } from "@/components/business-avatar";
import { Stars } from "@/components/stars";
import { getCategory } from "@/config/categories";
import { fr } from "@/i18n/fr";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Business } from "@/lib/supabase/types";

type Fav = Pick<Business, "id" | "name" | "slug" | "category" | "city" | "city_slug" | "cover_url" | "rating_avg" | "rating_count">;

export default async function FavoritesPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return null;
  const { data: favs } = await supabase.from("favorites").select("business_id").eq("user_id", user.id).returns<{ business_id: string }[]>();
  const ids = (favs ?? []).map((f) => f.business_id);
  const { data } = ids.length
    ? await createAdminClient().from("businesses").select("id, name, slug, category, city, city_slug, cover_url, rating_avg, rating_count").in("id", ids).returns<Fav[]>()
    : { data: [] as Fav[] };

  if (!data?.length) return <p className="card text-center text-ink-soft">{fr.account.noFavorites}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.map((b) => (
        <li key={b.id}>
          <Link href={businessPath(b)} className="card flex items-center gap-3 p-4 hover:border-brand">
            <BusinessAvatar name={b.name} category={b.category} coverUrl={b.cover_url} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-bold text-brand">{b.name}</span>
              <span className="block text-sm text-ink-soft">
                {getCategory(b.category)?.label}
                {b.city ? ` · ${b.city}` : ""}
              </span>
              <Stars rating={Number(b.rating_avg)} count={b.rating_count} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
