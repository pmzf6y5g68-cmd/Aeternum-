"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowUpDown, LocateFixed, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, GROUPS } from "@/config/categories";
import { fr } from "@/i18n/fr";

const t = fr.search;

function Select({ name, value, onChange, children, label, active }: { name: string; value: string; onChange: (name: string, v: string) => void; children: React.ReactNode; label: string; active: boolean }) {
  return (
    <label className={`${active ? "chip-active" : "chip"} relative shrink-0 cursor-pointer pr-2`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(name, e.target.value)} className="cursor-pointer appearance-none bg-transparent pr-1 font-medium outline-none">
        {children}
      </select>
    </label>
  );
}

export function FiltersBar({ showCategory }: { showCategory: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const hasLocation = params.has("lat") || params.has("ou");

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const [locating, setLocating] = useState(false);
  function aroundMe() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const next = new URLSearchParams(params.toString());
        next.set("lat", pos.coords.latitude.toFixed(5));
        next.set("lng", pos.coords.longitude.toFixed(5));
        next.set("ou", "Ma position");
        if (!next.get("rayon")) next.set("rayon", "5");
        next.set("tri", "distance");
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }
  const aroundActive = params.get("ou") === "Ma position";

  const activeCount = ["dispo", "mode", "prix_max", "rayon", "note"].filter((k) => params.get(k)).length + (showCategory && params.get("categorie") ? 1 : 0);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <span className="inline-flex shrink-0 items-center gap-1.5 pr-1 text-sm font-semibold text-ink">
        <SlidersHorizontal className="size-4" aria-hidden /> {t.filters}
      </span>
      <button type="button" onClick={aroundMe} aria-pressed={aroundActive} className={`${aroundActive ? "chip-active" : "chip"} shrink-0`}>
        <LocateFixed className={`size-3.5 ${locating ? "animate-pulse" : ""}`} aria-hidden /> Autour de moi
      </button>
      {showCategory && (
        <Select name="categorie" value={get("categorie")} onChange={update} label={t.allCategories} active={Boolean(get("categorie"))}>
          <option value="">{t.allCategories}</option>
          {GROUPS.map((g) => (
            <optgroup key={g.slug} label={g.label}>
              {CATEGORIES.filter((c) => c.group === g.slug).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}
      <Select name="dispo" value={get("dispo")} onChange={update} label={t.availability} active={Boolean(get("dispo"))}>
        <option value="">{t.availability} : {t.availabilityOptions.any}</option>
        <option value="today">{t.availabilityOptions.today}</option>
        <option value="3d">{t.availabilityOptions["3d"]}</option>
        <option value="7d">{t.availabilityOptions["7d"]}</option>
      </Select>
      <Select name="mode" value={get("mode")} onChange={update} label={t.mode} active={Boolean(get("mode"))}>
        <option value="">{t.mode} : {t.anyMode}</option>
        <option value="on_site">{fr.modes.on_site}</option>
        <option value="at_home">{fr.modes.at_home}</option>
        <option value="online">{fr.modes.online}</option>
      </Select>
      <Select name="prix_max" value={get("prix_max")} onChange={update} label={t.maxPrice} active={Boolean(get("prix_max"))}>
        <option value="">{t.anyPrice}</option>
        {[20, 30, 50, 80, 100, 150, 250, 500].map((p) => (
          <option key={p} value={p}>
            ≤ {p} €
          </option>
        ))}
      </Select>
      {hasLocation && (
        <Select name="rayon" value={get("rayon")} onChange={update} label={t.distance} active={Boolean(get("rayon"))}>
          <option value="">{t.distance} : 25 km</option>
          {[2, 5, 10, 50, 100].map((d) => (
            <option key={d} value={d}>
              ≤ {d} km
            </option>
          ))}
        </Select>
      )}
      <Select name="note" value={get("note")} onChange={update} label={t.rating} active={Boolean(get("note"))}>
        <option value="">{t.rating} : {t.anyRating}</option>
        <option value="4.5">★ 4,5 et +</option>
        <option value="4">★ 4 et +</option>
        <option value="3">★ 3 et +</option>
      </Select>
      <span className="mx-1 h-6 w-px shrink-0 bg-line" />
      <label className="chip relative shrink-0 cursor-pointer">
        <ArrowUpDown className="size-3.5" aria-hidden />
        <span className="sr-only">{t.sort}</span>
        <select value={get("tri")} onChange={(e) => update("tri", e.target.value)} className="cursor-pointer appearance-none bg-transparent font-medium outline-none">
          <option value="">{t.sorts.relevance}</option>
          {hasLocation && <option value="distance">{t.sorts.distance}</option>}
          <option value="availability">{t.sorts.availability}</option>
          <option value="price_asc">{t.sorts.price_asc}</option>
          <option value="price_desc">{t.sorts.price_desc}</option>
          <option value="rating">{t.sorts.rating}</option>
        </select>
      </label>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams();
            for (const k of ["q", "ou", "lat", "lng", ...(showCategory ? [] : ["categorie"])]) {
              const v = params.get(k);
              if (v) next.set(k, v);
            }
            router.push(`${pathname}?${next.toString()}`);
          }}
          className="inline-flex shrink-0 items-center gap-1 px-2 text-sm font-semibold text-brand hover:underline"
        >
          <X className="size-3.5" aria-hidden /> {t.reset}
        </button>
      )}
    </div>
  );
}
