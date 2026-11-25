/** Tarification Pro par agenda (membre d'équipe actif) : pure, testée, partagée par l'UI et Stripe. */
import { siteConfig } from "@/config/site";

export type BillingInterval = "month" | "year";

export function seatsFor(activeStaff: number): number {
  return Math.max(1, Math.floor(activeStaff));
}

export function proPriceCents(seats: number, interval: BillingInterval, p = siteConfig.pricing): number {
  const n = seatsFor(seats);
  const base = interval === "year" ? p.proYearlyPriceEur : p.proMonthlyPriceEur;
  const extra = interval === "year" ? p.proExtraSeatYearlyEur : p.proExtraSeatMonthlyEur;
  return Math.round((base + (n - 1) * extra) * 100);
}

/** Économie annuelle par rapport au paiement mensuel. */
export function yearlySavingsCents(seats: number): number {
  return proPriceCents(seats, "month") * 12 - proPriceCents(seats, "year");
}

/** Paliers Stripe « graduated » correspondants (1er agenda forfaitaire, suivants à l'unité). */
export function stripeTiers(interval: BillingInterval, p = siteConfig.pricing) {
  const base = interval === "year" ? p.proYearlyPriceEur : p.proMonthlyPriceEur;
  const extra = interval === "year" ? p.proExtraSeatYearlyEur : p.proExtraSeatMonthlyEur;
  return [
    { up_to: 1 as const, flat_amount: Math.round(base * 100), unit_amount: 0 },
    { up_to: "inf" as const, unit_amount: Math.round(extra * 100) },
  ];
}

export const PRICE_LOOKUP_KEYS: Record<BillingInterval, string> = { month: "rdv_pro_monthly_v2", year: "rdv_pro_yearly_v2" };
