import { type NextRequest } from "next/server";
import { getCategory } from "@/config/categories";
import { json, jsonError } from "@/lib/http";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

interface NearbyRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string | null;
  city_slug: string | null;
  address: string | null;
  lat: number;
  lng: number;
  min_price_eur: number | null;
  rating_avg: number;
  rating_count: number;
  plan: string;
  distance_km: number;
}

/** « Autour de moi » : partout en France, les établissements les plus proches dans chaque métier. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return jsonError("invalid_position", 400);
  const radius = Math.min(200, Math.max(1, Number(sp.get("rayon")) || 25));
  const perCategory = Math.min(10, Math.max(1, Number(sp.get("par_metier")) || 3));

  const { data, error } = await createAdminClient().rpc("nearby_by_category", { p_lat: lat, p_lng: lng, p_radius_km: radius, p_per_category: perCategory });
  if (error) return jsonError("server_error", 500);
  const rows = (data ?? []) as NearbyRow[];

  const groups = new Map<string, { slug: string; label: string; nearestKm: number; items: unknown[] }>();
  for (const r of rows) {
    const cat = getCategory(r.category);
    if (!cat) continue;
    const g = groups.get(cat.slug) ?? { slug: cat.slug, label: cat.label, nearestKm: r.distance_km, items: [] };
    g.items.push({
      id: r.id,
      name: r.name,
      path: businessPath(r),
      city: r.city,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      minPriceEur: r.min_price_eur === null ? null : Number(r.min_price_eur),
      rating: Number(r.rating_avg),
      reviews: r.rating_count,
      distanceKm: Math.round(r.distance_km * 10) / 10,
    });
    g.nearestKm = Math.min(g.nearestKm, r.distance_km);
    groups.set(cat.slug, g);
  }
  const categories = [...groups.values()].sort((a, b) => a.nearestKm - b.nearestKm);
  return json({ position: { lat, lng }, radiusKm: radius, total: rows.length, categories });
}
