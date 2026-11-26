"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Search, Store } from "lucide-react";
import { CATEGORY_BY_SLUG, type IconName } from "@/config/categories";
import { fr } from "@/i18n/fr";
import { CategoryIcon } from "./category-icon";

const t = fr.home;

interface Suggestions {
  categories: { slug: string; label: string; icon: IconName }[];
  businesses: { name: string; path: string; city: string | null; category: string }[];
}

interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface SearchBarProps {
  defaultQuery?: string;
  defaultCategory?: string | null;
  defaultPlace?: Place | null;
  defaultPlaceLabel?: string;
  size?: "lg" | "md";
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function SearchBar({ defaultQuery = "", defaultCategory = null, defaultPlace = null, defaultPlaceLabel = "", size = "lg" }: SearchBarProps) {
  const router = useRouter();
  const initialLabel = defaultCategory ? (CATEGORY_BY_SLUG.get(defaultCategory)?.label ?? defaultQuery) : defaultQuery;
  const [what, setWhat] = useState(initialLabel);
  const [category, setCategory] = useState<string | null>(defaultCategory);
  const [where, setWhere] = useState(defaultPlace?.label ?? defaultPlaceLabel);
  const [place, setPlace] = useState<Place | null>(defaultPlace);
  const [open, setOpen] = useState<"what" | "where" | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions>({ categories: [], businesses: [] });
  const [cities, setCities] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const root = useRef<HTMLFormElement>(null);

  const dWhat = useDebounced(what, 180);
  const dWhere = useDebounced(where, 220);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (open !== "what" || dWhat.trim().length < 2) {
      setSuggestions({ categories: [], businesses: [] });
      return;
    }
    const c = new AbortController();
    fetch(`/api/suggest?q=${encodeURIComponent(dWhat)}`, { signal: c.signal })
      .then((r) => r.json() as Promise<Suggestions>)
      .then(setSuggestions)
      .catch(() => undefined);
    return () => c.abort();
  }, [dWhat, open]);

  useEffect(() => {
    if (open !== "where" || dWhere.trim().length < 3 || place?.label === dWhere) {
      setCities([]);
      return;
    }
    const c = new AbortController();
    fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(dWhere)}&limit=6&autocomplete=1`, { signal: c.signal })
      .then((r) => r.json() as Promise<{ features?: { geometry: { coordinates: [number, number] }; properties: { label: string; type: string; city?: string; postcode?: string } }[] }>)
      .then((d) =>
        setCities(
          (d.features ?? []).map((f) => ({
            label: f.properties.type === "municipality" ? `${f.properties.label}${f.properties.postcode ? ` (${f.properties.postcode.slice(0, 2)})` : ""}` : f.properties.label,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          })),
        ),
      )
      .catch(() => undefined);
    return () => c.abort();
  }, [dWhere, open, place?.label]);

  function go(nextCategory: string | null, nextQuery: string, nextPlace: Place | null) {
    const params = new URLSearchParams();
    if (nextCategory) params.set("categorie", nextCategory);
    else if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextPlace) {
      params.set("ou", nextPlace.label);
      params.set("lat", nextPlace.lat.toFixed(5));
      params.set("lng", nextPlace.lng.toFixed(5));
    } else if (where.trim()) {
      params.set("ou", where.trim());
    }
    setOpen(null);
    router.push(`/recherche?${params.toString()}`);
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { label: t.aroundMe, lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPlace(p);
        setWhere(p.label);
        setLocating(false);
        setOpen(null);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  const tall = size === "lg";
  const hasWhatMenu = open === "what" && (suggestions.categories.length > 0 || suggestions.businesses.length > 0);

  return (
    <form
      ref={root}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(category, what, place);
      }}
      className={`relative flex w-full flex-col gap-2 rounded-xl bg-white p-2 shadow-(--shadow-pop) md:flex-row md:items-center md:gap-0 ${tall ? "md:p-2" : "md:p-1.5"}`}
    >
      <div className="relative flex-1">
        <label className="flex items-center gap-2.5 rounded-lg px-3 hover:bg-brand-softer">
          <Search className="size-5 shrink-0 text-brand" aria-hidden />
          <input
            value={what}
            onChange={(e) => {
              setWhat(e.target.value);
              setCategory(null);
              setOpen("what");
            }}
            onFocus={() => setOpen("what")}
            placeholder={t.whatPlaceholder}
            aria-label={t.whatPlaceholder}
            autoComplete="off"
            className={`w-full bg-transparent text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-slate-400 ${tall ? "py-3.5" : "py-2.5"}`}
          />
        </label>
        {hasWhatMenu && (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-(--shadow-pop)">
            {suggestions.categories.length > 0 && (
              <div className="py-2">
                <p className="px-4 pb-1 text-xs font-semibold text-ink-soft">{fr.search.suggestions.categories}</p>
                {suggestions.categories.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => {
                      setWhat(c.label);
                      setCategory(c.slug);
                      go(c.slug, "", place);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-brand-softer"
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
                      <CategoryIcon name={c.icon} className="size-4" />
                    </span>
                    <span className="font-medium">{c.label}</span>
                  </button>
                ))}
              </div>
            )}
            {suggestions.businesses.length > 0 && (
              <div className="border-t border-line py-2">
                <p className="px-4 pb-1 text-xs font-semibold text-ink-soft">{fr.search.suggestions.businesses}</p>
                {suggestions.businesses.map((b) => (
                  <button key={b.path} type="button" onClick={() => router.push(b.path)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-brand-softer">
                    <span className="grid size-8 place-items-center rounded-lg bg-canvas text-ink-soft">
                      <Store className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-medium">{b.name}</span>
                      <span className="block text-xs text-ink-soft">
                        {CATEGORY_BY_SLUG.get(b.category)?.label}
                        {b.city ? ` · ${b.city}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden h-8 w-px bg-line md:block" />

      <div className="relative flex-1">
        <label className="flex items-center gap-2.5 rounded-lg px-3 hover:bg-brand-softer">
          <MapPin className="size-5 shrink-0 text-brand" aria-hidden />
          <input
            value={where}
            onChange={(e) => {
              setWhere(e.target.value);
              setPlace(null);
              setOpen("where");
            }}
            onFocus={() => setOpen("where")}
            placeholder={t.wherePlaceholder}
            aria-label={t.wherePlaceholder}
            autoComplete="off"
            className={`w-full bg-transparent text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-slate-400 ${tall ? "py-3.5" : "py-2.5"}`}
          />
        </label>
        {open === "where" && (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-white py-2 shadow-(--shadow-pop)">
            <button type="button" onClick={locate} className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-semibold text-brand hover:bg-brand-softer">
              <LocateFixed className={`size-5 ${locating ? "animate-pulse" : ""}`} aria-hidden />
              {t.aroundMe}
            </button>
            {cities.map((c) => (
              <button
                key={`${c.label}-${c.lat}`}
                type="button"
                onClick={() => {
                  setPlace(c);
                  setWhere(c.label);
                  setOpen(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-brand-softer"
              >
                <MapPin className="size-4 text-ink-soft" aria-hidden />
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="submit" className={`btn-primary shrink-0 md:ml-2 ${tall ? "px-7 py-3.5 text-base" : "px-5"}`}>
        <Search className="size-4 md:hidden" aria-hidden />
        {t.search}
      </button>
    </form>
  );
}
