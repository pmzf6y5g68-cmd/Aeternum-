import type { LocationMode } from "@/config/categories";

export interface SerializedResult {
  id: string;
  name: string;
  category: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  modes: LocationMode[];
  cover_url: string | null;
  min_price_eur: number | null;
  rating_avg: number;
  rating_count: number;
  distance_km: number | null;
  path: string;
  nextSlotAt: string | null;
  preview: { date: string; slots: { time: string; startAt: string }[] }[];
}
