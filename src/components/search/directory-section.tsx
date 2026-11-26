import Link from "next/link";
import { Globe, MapPin, Phone } from "lucide-react";
import { getCategory } from "@/config/categories";
import { createAdminClient } from "@/lib/supabase/admin";

interface Listing {
  id: string;
  category: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  distance_km?: number;
}

const km = (d: number) => (d < 1 ? `${Math.round(d * 100) * 10} m` : `${d.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`);

/**
 * Annuaire ouvert : établissements pas encore inscrits (OpenStreetMap). Affichés APRÈS les établissements
 * réservables, sans réservation ni avis, clairement signalés, avec appel direct, retrait et revendication.
 */
export async function DirectorySection({ lat, lng, citySlug, category, hasResults }: { lat: number | null; lng: number | null; citySlug: string | null; category: string | null; hasResults: boolean }) {
  const admin = createAdminClient();
  let rows: Listing[] = [];
  try {
    if (lat !== null && lng !== null) {
      const { data } = await admin.rpc("nearby_listings", { p_lat: lat, p_lng: lng, p_radius_km: 10, p_category: category, p_limit: 12 });
      rows = (data ?? []) as Listing[];
    } else if (citySlug) {
      let q = admin.from("directory_listings").select("id, category, name, address, city, phone, website, opening_hours").eq("city_slug", citySlug).is("opted_out_at", null).is("claimed_business_id", null).order("name").limit(12);
      if (category) q = q.eq("category", category);
      rows = ((await q).data ?? []) as Listing[];
    }
  } catch {
    rows = [];
  }
  if (!rows.length) return null;

  return (
    <section className="mt-10" aria-labelledby="annuaire">
      <h2 id="annuaire" className="text-xl font-bold">
        {hasResults ? "Autres établissements à proximité" : "Établissements à proximité"}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">Pas encore sur Rendez-vous : réservation en ligne indisponible, contactez-les directement.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((l) => (
          <li key={l.id} className="card flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-ink-soft">
                  {getCategory(l.category)?.label}
                  {l.distance_km !== undefined ? ` · ${km(l.distance_km)}` : ""}
                </p>
              </div>
            </div>
            {(l.address || l.city) && (
              <p className="flex items-start gap-1.5 text-sm text-ink-soft">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {[l.address, l.city].filter(Boolean).join(", ")}
              </p>
            )}
            {l.opening_hours && <p className="line-clamp-1 text-xs text-ink-soft">Horaires : {l.opening_hours}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              {l.phone && (
                <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="btn-secondary px-3 py-1.5 text-sm">
                  <Phone className="size-4" aria-hidden /> Appeler
                </a>
              )}
              {l.website && (
                <a href={l.website} target="_blank" rel="noopener noreferrer nofollow" className="btn-ghost px-3 py-1.5 text-sm">
                  <Globe className="size-4" aria-hidden /> Site
                </a>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs">
              <Link href={`/pro/inscription?fiche=${l.id}`} className="font-semibold text-brand hover:underline">
                C&apos;est votre établissement ? Activez la réservation gratuitement
              </Link>
              <Link href={`/annuaire/retrait/${l.id}`} className="text-ink-soft hover:underline">
                Retirer cette fiche
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        Données{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
          © les contributeurs d&apos;OpenStreetMap
        </a>
        , licence ODbL. Une information inexacte ? Corrigez-la sur OpenStreetMap ou retirez la fiche.
      </p>
    </section>
  );
}
