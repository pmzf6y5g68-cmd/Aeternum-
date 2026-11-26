"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import { LocateFixed, RefreshCw } from "lucide-react";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href: string;
  title: string;
  subtitle: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Distance en km entre deux points (formule de Haversine). */
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Carte des résultats (fond OpenStreetMap / CARTO), synchronisée avec la liste :
 * survol croisé, aperçu au clic, « Autour de moi », « Rechercher dans cette zone » après déplacement.
 */
export function ResultsMap({ points, center, radiusKm = null, activeId, onHover, controls = true }: { points: MapPoint[]; center: { lat: number; lng: number } | null; radiusKm?: number | null; activeId: string | null; onHover: (id: string | null) => void; controls?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const overlay = useRef<{ me: Marker | null; circle: Circle | null }>({ me: null, circle: null });
  const fitting = useRef(false);
  const [moved, setMoved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function pushLocation(lat: number, lng: number, label: string, rayon?: number) {
    const next = new URLSearchParams(params.toString());
    next.set("lat", lat.toFixed(5));
    next.set("lng", lng.toFixed(5));
    next.set("ou", label);
    if (rayon) next.set("rayon", String(rayon));
    if (!next.get("tri")) next.set("tri", "distance");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: false, scrollWheelZoom: true, tap: true } as L.MapOptions);
        L.control.zoom({ position: "bottomright" }).addTo(map.current);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 20,
          subdomains: "abcd",
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(map.current);
        map.current.on("moveend", () => {
          if (!fitting.current) setMoved(true);
        });
      }
      const m = map.current;
      markers.current.forEach((mk) => mk.remove());
      markers.current.clear();
      overlay.current.me?.remove();
      overlay.current.circle?.remove();
      const bounds = L.latLngBounds([]);
      for (const p of points) {
        const icon = L.divIcon({ className: "", html: `<span class="price-pin" data-id="${esc(p.id)}">${esc(p.label)}</span>`, iconSize: [0, 0] });
        const marker = L.marker([p.lat, p.lng], { icon, title: p.title, riseOnHover: true, keyboard: true }).addTo(m);
        marker.bindPopup(
          `<a href="${esc(p.href)}" class="map-card"><strong>${esc(p.title)}</strong><span>${esc(p.subtitle)}</span><em>Voir les créneaux →</em></a>`,
          { closeButton: false, offset: [0, -6], className: "map-popup" },
        );
        marker.on("mouseover", () => onHover(p.id));
        marker.on("mouseout", () => onHover(null));
        marker.on("click", () => {
          onHover(p.id);
          document.getElementById(`r-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        markers.current.set(p.id, marker);
        bounds.extend([p.lat, p.lng]);
      }
      if (center) {
        overlay.current.me = L.marker([center.lat, center.lng], {
          icon: L.divIcon({ className: "", html: '<span class="me-dot" aria-label="Votre position"></span>', iconSize: [0, 0] }),
          interactive: false,
          zIndexOffset: 2000,
        }).addTo(m);
        overlay.current.circle = L.circle([center.lat, center.lng], { radius: (radiusKm ?? 25) * 1000, color: "#1758e6", weight: 1, fillOpacity: 0.04, interactive: false }).addTo(m);
        bounds.extend([center.lat, center.lng]);
      }
      fitting.current = true;
      if (bounds.isValid()) m.fitBounds(bounds.pad(0.12), { maxZoom: 15 });
      else m.setView([46.6, 2.4], 5);
      setTimeout(() => {
        fitting.current = false;
        setMoved(false);
      }, 400);
    })();
    return () => {
      cancelled = true;
    };
  }, [points, center, radiusKm, onHover]);

  useEffect(() => {
    markers.current.forEach((mk, id) => {
      const node = mk.getElement()?.querySelector(".price-pin");
      node?.classList.toggle("active", id === activeId);
      mk.setZIndexOffset(id === activeId ? 1000 : 0);
    });
  }, [activeId]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  function searchHere() {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    const b = m.getBounds();
    const rayon = Math.max(1, Math.min(100, Math.round(haversine({ lat: c.lat, lng: c.lng }, { lat: b.getNorth(), lng: b.getEast() }))));
    pushLocation(c.lat, c.lng, "Zone de la carte", rayon);
    setMoved(false);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pushLocation(pos.coords.latitude, pos.coords.longitude, "Ma position", Number(params.get("rayon")) || 5);
      },
      () => {
        setLocating(false);
        setGeoError("Position refusée : autorisez la localisation ou saisissez une adresse.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="relative h-full min-h-80 w-full">
      <div ref={el} className="h-full w-full rounded-xl" />
      <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
        {controls && moved && (
          <button type="button" onClick={searchHere} className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-(--shadow-pop) hover:text-brand">
            <RefreshCw className="size-4" aria-hidden /> Rechercher dans cette zone
          </button>
        )}
      </div>
      {controls && (
      <button
        type="button"
        onClick={locate}
        aria-label="Autour de moi"
        className="absolute left-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold text-ink shadow-(--shadow-pop) hover:text-brand"
      >
        <LocateFixed className={`size-4 ${locating ? "animate-pulse text-brand" : ""}`} aria-hidden /> Autour de moi
      </button>
      )}
      {geoError && <p className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-surface p-2.5 text-xs font-medium text-danger shadow-(--shadow-pop)">{geoError}</p>}
    </div>
  );
}
