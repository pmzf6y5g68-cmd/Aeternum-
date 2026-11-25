/**
 * Géocodage gratuit : Base Adresse Nationale (api-adresse.data.gouv.fr), puis Nominatim en secours.
 */
import type { LatLng } from "./pricing";

export interface GeocodeResult extends LatLng {
  label: string;
  city: string | null;
  source: "ban" | "nominatim";
}

const TIMEOUT_MS = 5000;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface BanResponse {
  features?: { geometry?: { coordinates?: [number, number] }; properties?: { label?: string; city?: string; score?: number } }[];
}

interface NominatimItem {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: { city?: string; town?: string; village?: string };
}

async function geocodeBan(query: string): Promise<GeocodeResult | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
  const data = (await fetchJson(url)) as BanResponse;
  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!feature || !coords || (feature.properties?.score ?? 0) < 0.4) return null;
  return {
    lng: coords[0],
    lat: coords[1],
    label: feature.properties?.label ?? query,
    city: feature.properties?.city ?? null,
    source: "ban",
  };
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`;
  const data = (await fetchJson(url, { "User-Agent": "SlotlyBookingApp/1.0", "Accept-Language": "fr" })) as NominatimItem[];
  const item = data[0];
  if (!item?.lat || !item.lon) return null;
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    label: item.display_name ?? query,
    city: item.address?.city ?? item.address?.town ?? item.address?.village ?? null,
    source: "nominatim",
  };
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (q.length < 5) return null;
  try {
    const ban = await geocodeBan(q);
    if (ban) return ban;
  } catch {
    // Bascule sur Nominatim.
  }
  try {
    return await geocodeNominatim(q);
  } catch {
    return null;
  }
}
