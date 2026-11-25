/** Commission « nouveau client marketplace » (plan Gratuit), modèle inspiré de Treatwell. Pure et testée. */
export type BookingSource = "marketplace" | "direct" | "assistant";

export interface CommissionInput {
  plan: "free" | "pro";
  source: BookingSource;
  isNewClient: boolean;
  totalCents: number;
  percent: number;
  capEur: number;
}

export function commissionCents(input: CommissionInput): number {
  if (input.plan !== "free" || input.source === "direct" || !input.isNewClient || input.totalCents <= 0) return 0;
  const raw = Math.round((input.totalCents * input.percent) / 100);
  return Math.min(raw, Math.round(input.capEur * 100));
}
