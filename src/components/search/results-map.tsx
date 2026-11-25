"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href: string;
  title: string;
}

/** Carte OpenStreetMap (gratuite) avec pastilles de prix, synchronisée avec la liste. */
export function ResultsMap({ points, center, activeId, onHover }: { points: MapPoint[]; center: { lat: number; lng: number } | null; activeId: string | null; onHover: (id: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map.current);
      }
      const m = map.current;
      markers.current.forEach((mk) => mk.remove());
      markers.current.clear();
      const bounds = L.latLngBounds([]);
      for (const p of points) {
        const icon = L.divIcon({ className: "", html: `<span class="price-pin" data-id="${p.id}">${p.label}</span>`, iconSize: [0, 0] });
        const marker = L.marker([p.lat, p.lng], { icon, title: p.title, riseOnHover: true }).addTo(m);
        marker.on("click", () => {
          window.location.href = p.href;
        });
        marker.on("mouseover", () => onHover(p.id));
        marker.on("mouseout", () => onHover(null));
        markers.current.set(p.id, marker);
        bounds.extend([p.lat, p.lng]);
      }
      if (center) bounds.extend([center.lat, center.lng]);
      if (bounds.isValid()) m.fitBounds(bounds.pad(0.15), { maxZoom: 14 });
      else m.setView([46.6, 2.4], 5);
    })();
    return () => {
      cancelled = true;
    };
  }, [points, center, onHover]);

  useEffect(() => {
    markers.current.forEach((mk, id) => {
      const node = mk.getElement()?.querySelector(".price-pin");
      node?.classList.toggle("active", id === activeId);
      if (id === activeId) mk.setZIndexOffset(1000);
      else mk.setZIndexOffset(0);
    });
  }, [activeId]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={el} className="h-full min-h-80 w-full rounded-xl" />;
}
