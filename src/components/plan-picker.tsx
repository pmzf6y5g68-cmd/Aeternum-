"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { siteConfig } from "@/config/site";
import { proPriceCents, yearlySavingsCents, type BillingInterval } from "@/lib/domain/plans";
import { PostRedirectButton } from "./post-redirect-button";

const eur = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/**
 * Prix Pro transparent : 1 agenda inclus, agendas supplémentaires à l'unité, annuel = 2 mois offerts.
 * Mode « checkout » (espace pro) ou « simulateur » (page /pro).
 */
export function PlanPicker({ initialSeats = 1, mode, ctaHref = "/pro/inscription" }: { initialSeats?: number; mode: "checkout" | "simulator"; ctaHref?: string }) {
  const [seats, setSeats] = useState(Math.max(1, initialSeats));
  const [interval, setInterval] = useState<BillingInterval>("year");
  const p = siteConfig.pricing;
  const price = proPriceCents(seats, interval);
  const perMonth = interval === "year" ? Math.round(price / 12) : price;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line bg-white p-1">
        {(["month", "year"] as const).map((i) => (
          <button key={i} type="button" onClick={() => setInterval(i)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${interval === i ? "bg-brand text-white" : "text-ink-soft"}`}>
            {i === "month" ? "Mensuel" : "Annuel · 2 mois offerts"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold">Agendas (membres de l&apos;équipe)</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary size-9 p-0" onClick={() => setSeats((s) => Math.max(1, s - 1))} aria-label="Moins">
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-8 text-center text-lg font-bold">{seats}</span>
          <button type="button" className="btn-secondary size-9 p-0" onClick={() => setSeats((s) => Math.min(50, s + 1))} aria-label="Plus">
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div>
        <p className="text-4xl font-bold">
          {eur(perMonth)}
          <span className="text-base font-medium text-ink-soft"> /mois{interval === "year" ? ", facturé " + eur(price) + "/an" : ""}</span>
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {eur(Math.round((interval === "year" ? p.proYearlyPriceEur : p.proMonthlyPriceEur) * 100))} le 1er agenda + {eur(Math.round((interval === "year" ? p.proExtraSeatYearlyEur : p.proExtraSeatMonthlyEur) * 100))} par agenda supplémentaire
          {interval === "year" ? ` · vous économisez ${eur(yearlySavingsCents(seats))}` : ""}. TTC, 0 % de commission, sans engagement, {p.proTrialDays} jours offerts.
        </p>
      </div>
      {mode === "checkout" ? (
        <PostRedirectButton endpoint="/api/stripe/subscription" body={{ interval }} label={`Essayer Pro ${p.proTrialDays} jours gratuitement`} />
      ) : (
        <a href={ctaHref} className="btn-primary">
          Commencer gratuitement
        </a>
      )}
    </div>
  );
}
