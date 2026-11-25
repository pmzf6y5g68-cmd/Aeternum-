"use client";

import { useCallback, useMemo, useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { fr } from "@/i18n/fr";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { ResultCard } from "./result-card";
import { ResultsMap, type MapPoint } from "./results-map";
import type { SerializedResult } from "./types";

export function ResultsView({ results, center }: { results: SerializedResult[]; center: { lat: number; lng: number } | null }) {
  const [active, setActive] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const onHover = useCallback((id: string | null) => setActive(id), []);

  const points = useMemo<MapPoint[]>(
    () =>
      results
        .filter((r) => r.lat !== null && r.lng !== null)
        .map((r) => ({
          id: r.id,
          lat: r.lat as number,
          lng: r.lng as number,
          title: r.name,
          href: r.path,
          label: r.min_price_eur === null ? "•" : Number(r.min_price_eur) === 0 ? fr.common.free : formatEur(eurToCents(r.min_price_eur)),
        })),
    [results],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className={`space-y-4 ${showMap ? "hidden lg:block" : ""}`}>
        {results.map((r) => (
          <ResultCard key={r.id} r={r} active={active === r.id} onHover={onHover} />
        ))}
      </div>
      <div className={`${showMap ? "block" : "hidden"} lg:block`}>
        <div className="sticky top-36 h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-line bg-white lg:top-24 lg:h-[calc(100dvh-7.5rem)]">
          <ResultsMap points={points} center={center} activeId={active} onHover={onHover} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="fixed bottom-5 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-(--shadow-pop) lg:hidden"
      >
        {showMap ? <List className="size-4" aria-hidden /> : <MapIcon className="size-4" aria-hidden />}
        {showMap ? fr.search.hideMap : fr.search.showMap}
      </button>
    </div>
  );
}
