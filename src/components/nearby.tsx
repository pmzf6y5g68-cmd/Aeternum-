"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LocateFixed, MapPin, Star } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { CATEGORY_BY_SLUG } from "@/config/categories";
import { ResultsMap, type MapPoint } from "@/components/search/results-map";

interface Item {
  id: string;
  name: string;
  path: string;
  city: string | null;
  lat: number;
  lng: number;
  minPriceEur: number | null;
  rating: number;
  reviews: number;
  distanceKm: number;
  /** Fiche de l'annuaire ouvert : pas encore inscrit, pas de réservation en ligne. */
  unlisted?: boolean;
}
interface Group {
  slug: string;
  label: string;
  nearestKm: number;
  items: Item[];
}
interface Pos {
  lat: number;
  lng: number;
}

const KEY = "rdv_position";
const km = (d: number) => (d < 1 ? `${Math.round(d * 100) * 10} m` : `${d.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`);
const noop = () => undefined;

/**
 * Accueil « Autour de moi » : où que soit l'usager, il partage sa position et voit, métier par métier,
 * les établissements les plus proches, sur une carte et en liste. La position reste dans son navigateur.
 */
export function NearbyAllCategories() {
  const [pos, setPos] = useState<Pos | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [state, setState] = useState<"idle" | "locating" | "loading" | "denied" | "error">("idle");
  const [radius, setRadius] = useState(10);

  const load = useCallback(async (p: Pos, r: number) => {
    setState("loading");
    try {
      const res = await fetch(`/api/nearby?lat=${p.lat}&lng=${p.lng}&rayon=${r}&par_metier=3`);
      if (!res.ok) throw new Error("http");
      const data = (await res.json()) as { categories: Group[] };
      setGroups(data.categories);
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pos | null;
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
        setPos(saved);
        void load(saved, radius);
      }
    } catch {
      // Stockage indisponible : l'usager partagera sa position.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function share() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 };
        setPos(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // Pas de mémorisation possible : sans conséquence.
        }
        void load(next, radius);
      },
      () => setState("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 120_000 },
    );
  }

  const points = useMemo<MapPoint[]>(
    () =>
      (groups ?? []).flatMap((g) =>
        g.items.slice(0, 1).map((i) => ({
          id: i.id,
          lat: i.lat,
          lng: i.lng,
          title: i.name,
          href: i.path,
          label: g.label,
          subtitle: [i.reviews > 0 ? `★ ${i.rating.toFixed(1).replace(".", ",")}` : null, km(i.distanceKm), i.city].filter(Boolean).join(" · "),
        })),
      ),
    [groups],
  );

  if (!pos) {
    return (
      <div className="card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold md:text-2xl">Autour de chez vous, dans tous les domaines</h2>
          <p className="mt-1 max-w-xl text-ink-soft">Partagez votre position : nous affichons le coiffeur, le garage, le coach, le plombier… les plus proches, avec leurs prix et leurs prochains créneaux.</p>
          {state === "denied" && <p className="mt-2 text-sm font-medium text-danger">Position refusée. Autorisez la localisation dans votre navigateur, ou cherchez une ville ci-dessus.</p>}
        </div>
        <button type="button" onClick={share} className="btn-primary shrink-0 px-5 py-3 text-base">
          <LocateFixed className={`size-5 ${state === "locating" ? "animate-pulse" : ""}`} aria-hidden /> {state === "locating" ? "Localisation…" : "Partager ma position"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold md:text-2xl">Le plus proche de vous, dans chaque domaine</h2>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="nearby-radius" className="font-semibold">
            Rayon
          </label>
          <select
            id="nearby-radius"
            value={radius}
            onChange={(e) => {
              const r = Number(e.target.value);
              setRadius(r);
              void load(pos, r);
            }}
            className="input w-auto py-1.5"
          >
            {[2, 5, 10, 25, 50].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
          <button type="button" onClick={share} className="btn-secondary py-1.5 text-sm">
            <MapPin className="size-4" aria-hidden /> Actualiser ma position
          </button>
        </div>
      </div>
      {state === "error" && <p className="text-sm font-medium text-danger">Impossible de charger les établissements proches. Réessayez dans un instant.</p>}
      {groups && groups.length === 0 && state === "idle" && (
        <p className="card text-ink-soft">Aucun établissement inscrit dans ce rayon pour l&apos;instant. Élargissez le rayon ou faites découvrir Rendez-vous à vos commerçants.</p>
      )}
      {groups && groups.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.slug} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Link href={`/recherche?categorie=${g.slug}&lat=${pos.lat}&lng=${pos.lng}&ou=Ma%20position&tri=distance`} className="flex items-center gap-2 font-bold hover:text-brand">
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
                      <CategoryIcon name={CATEGORY_BY_SLUG.get(g.slug)?.icon ?? "Store"} className="size-4" />
                    </span>
                    {g.label}
                  </Link>
                  <span className="text-xs text-ink-soft">dès {km(g.nearestKm)}</span>
                </div>
                <ul className="divide-y divide-line">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <Link href={i.path} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{i.name}</span>
                          <span className="text-xs text-ink-soft">
                            {km(i.distanceKm)}
                            {i.unlisted && " · pas encore sur Rendez-vous"}
                            {i.reviews > 0 && (
                              <>
                                {" · "}
                                <Star className="inline size-3 fill-current text-sun" aria-hidden /> {i.rating.toFixed(1).replace(".", ",")}
                              </>
                            )}
                          </span>
                        </span>
                        {i.unlisted && i.path.startsWith("tel:") && <span className="shrink-0 text-xs font-semibold text-brand">Appeler</span>}
                        {i.minPriceEur !== null && <span className="shrink-0 font-bold">{i.minPriceEur === 0 ? "Gratuit" : `${i.minPriceEur} €`}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="h-96 overflow-hidden rounded-xl border border-line lg:sticky lg:top-24 lg:h-[32rem]">
            <ResultsMap points={points} center={pos} radiusKm={radius} activeId={null} onHover={noop} controls={false} />
          </div>
        </div>
      )}
    </div>
  );
}
