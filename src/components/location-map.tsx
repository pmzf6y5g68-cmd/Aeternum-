"use client";

import { useMemo } from "react";
import { ResultsMap } from "./search/results-map";

const noop = () => undefined;

export function LocationMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const points = useMemo(() => [{ id: "here", lat, lng, label, href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, title: label, subtitle: "Itinéraire dans Google Maps" }], [lat, lng, label]);
  return (
    <div className="h-56 overflow-hidden rounded-lg border border-line">
      <ResultsMap points={points} center={null} activeId="here" onHover={noop} controls={false} />
    </div>
  );
}
