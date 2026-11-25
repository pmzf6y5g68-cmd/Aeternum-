/** Transforme les modèles de catégorie en catalogue concret (prestations avec variantes, options, horaires). */
import type { CategoryDef, LocationMode } from "@/config/categories";
import type { Variant } from "@/lib/domain/pricing";

export interface ServiceSeed {
  name: string;
  description: string;
  price_eur: number;
  duration_minutes: number;
  variants: Variant[];
  capacity: number;
  modes: LocationMode[];
  sort: number;
}

/** Arrondi commercial : à l'euro sous 100 €, aux 5 € au-delà. */
export function roundPrice(value: number): number {
  if (value <= 0) return 0;
  return value < 100 ? Math.round(value) : Math.round(value / 5) * 5;
}

/** Durée arrondie aux 5 minutes, minimum 5. */
export function roundDuration(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function buildSeedServices(category: CategoryDef): ServiceSeed[] {
  return category.seed.map(([name, price, duration, description], index) => ({
    name,
    description,
    price_eur: price,
    duration_minutes: duration,
    variants: (category.variants ?? []).map((v) => ({
      key: v.key,
      label: v.label,
      price_eur: roundPrice(price * v.priceFactor),
      duration_minutes: roundDuration(duration * v.durationFactor),
    })),
    capacity: category.capacity ?? 1,
    modes: [],
    sort: index,
  }));
}

export function buildSeedAddons(category: CategoryDef) {
  return (category.addons ?? []).map(([name, price_eur, duration_minutes]) => ({ name, price_eur, duration_minutes }));
}

/** Horaires standard selon l'univers : restaurants midi/soir, loisirs l'après-midi, sinon journée continue avec pause. */
export function buildSeedHours(category: CategoryDef) {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const closed = { day_of_week: day, open_time: null, close_time: null, break_start: null, break_end: null, is_closed: true };
    if (category.slug === "restaurant") {
      if (day === 1) return closed;
      return { day_of_week: day, open_time: "12:00", close_time: "22:30", break_start: "14:30", break_end: "19:00", is_closed: false };
    }
    if (category.group === "loisirs") {
      return { day_of_week: day, open_time: day === 0 || day === 6 ? "10:00" : "14:00", close_time: "22:00", break_start: null, break_end: null, is_closed: false };
    }
    if (day === 0) return closed;
    if (day === 6) return { day_of_week: day, open_time: "09:00", close_time: "17:00", break_start: null, break_end: null, is_closed: false };
    return { day_of_week: day, open_time: "09:00", close_time: "19:00", break_start: "12:30", break_end: "13:30", is_closed: false };
  });
}
