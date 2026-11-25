/** Catalogue de démarrage créé en 1 clic à l'onboarding (modifiable ensuite dans le dashboard). */
import type { SizePricingMap } from "@/lib/domain/pricing";

export interface DefaultService {
  name: string;
  description: string;
  base_price_eur: number;
  base_duration_minutes: number;
  size_pricing_json: SizePricingMap;
}

export const DEFAULT_SERVICES: DefaultService[] = [
  {
    name: "Lavage intérieur & extérieur",
    description: "Prélavage, lavage main, jantes, aspiration complète, vitres et plastiques.",
    base_price_eur: 59,
    base_duration_minutes: 90,
    size_pricing_json: {
      citadine: { price_eur: 49, duration_minutes: 75 },
      berline: { price_eur: 59, duration_minutes: 90 },
      suv_4x4: { price_eur: 69, duration_minutes: 105 },
      utilitaire: { price_eur: 79, duration_minutes: 120 },
    },
  },
  {
    name: "Nettoyage intérieur complet",
    description: "Aspiration, shampoing des tapis, nettoyage des plastiques et des cuirs, vitres.",
    base_price_eur: 89,
    base_duration_minutes: 150,
    size_pricing_json: {
      citadine: { price_eur: 79, duration_minutes: 120 },
      berline: { price_eur: 89, duration_minutes: 150 },
      suv_4x4: { price_eur: 109, duration_minutes: 180 },
      utilitaire: { price_eur: 129, duration_minutes: 210 },
    },
  },
  {
    name: "Polissage carrosserie 1 étape",
    description: "Décontamination, polissage une étape pour raviver la brillance, protection cire.",
    base_price_eur: 189,
    base_duration_minutes: 240,
    size_pricing_json: {
      citadine: { price_eur: 169, duration_minutes: 210 },
      berline: { price_eur: 189, duration_minutes: 240 },
      suv_4x4: { price_eur: 229, duration_minutes: 300 },
      utilitaire: { price_eur: 259, duration_minutes: 330 },
    },
  },
  {
    name: "Rénovation complète premium",
    description: "Intérieur complet + polissage + protection céramique 12 mois.",
    base_price_eur: 349,
    base_duration_minutes: 420,
    size_pricing_json: {
      citadine: { price_eur: 299, duration_minutes: 360 },
      berline: { price_eur: 349, duration_minutes: 420 },
      suv_4x4: { price_eur: 399, duration_minutes: 480 },
      utilitaire: { price_eur: 449, duration_minutes: 510 },
    },
  },
];

export const DEFAULT_ADDONS = [
  { name: "Céramique jantes", price_eur: 39, duration_minutes: 30 },
  { name: "Désinfection à l'ozone", price_eur: 29, duration_minutes: 30 },
  { name: "Rénovation des optiques", price_eur: 35, duration_minutes: 30 },
  { name: "Shampoing sièges tissu", price_eur: 45, duration_minutes: 45 },
];

/** 0 = dimanche. Lun-Ven 9h-18h (pause 12h30-13h30), Sam 9h-17h, Dim fermé. */
export const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => {
  if (day === 0) return { day_of_week: day, open_time: null, close_time: null, break_start: null, break_end: null, is_closed: true };
  if (day === 6) return { day_of_week: day, open_time: "09:00", close_time: "17:00", break_start: null, break_end: null, is_closed: false };
  return { day_of_week: day, open_time: "09:00", close_time: "18:00", break_start: "12:30", break_end: "13:30", is_closed: false };
});
