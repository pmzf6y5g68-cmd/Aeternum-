"use client";

import { useMemo, useState } from "react";
import { siteConfig } from "@/config/site";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";

const t = fr.landing.calculator;
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const NO_SHOW_REDUCTION = 0.8;

function Slider(props: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">{props.label}</span>
        <span className="font-semibold text-ink">
          {props.value}
          {props.suffix}
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#0F766E]"
      />
    </label>
  );
}

export function RevenueCalculator() {
  const [bookings, setBookings] = useState(60);
  const [ticket, setTicket] = useState(120);
  const [noShow, setNoShow] = useState(10);
  const [upsellRate, setUpsellRate] = useState(25);
  const [upsellValue, setUpsellValue] = useState(35);

  const result = useMemo(() => {
    const saved = bookings * (noShow / 100) * NO_SHOW_REDUCTION * ticket;
    const upsell = bookings * (upsellRate / 100) * upsellValue;
    const total = saved + upsell;
    return { saved, upsell, total, roi: Math.max(0, Math.round(total / siteConfig.pricing.proMonthlyPriceEur)) };
  }, [bookings, ticket, noShow, upsellRate, upsellValue]);

  return (
    <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 md:p-8">
      <div className="space-y-5">
        <Slider label={t.bookingsPerMonth} value={bookings} min={10} max={300} step={5} suffix="" onChange={setBookings} />
        <Slider label={t.averageTicket} value={ticket} min={30} max={600} step={10} suffix=" €" onChange={setTicket} />
        <Slider label={t.noShowRate} value={noShow} min={0} max={30} step={1} suffix=" %" onChange={setNoShow} />
        <Slider label={t.upsellRate} value={upsellRate} min={0} max={80} step={5} suffix=" %" onChange={setUpsellRate} />
        <Slider label={t.upsellValue} value={upsellValue} min={10} max={200} step={5} suffix=" €" onChange={setUpsellValue} />
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-muted p-6">
        <dl className="space-y-3">
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-600">{t.savedNoShows}</dt>
            <dd className="font-semibold">{eur.format(result.saved)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-600">{t.upsellRevenue}</dt>
            <dd className="font-semibold">{eur.format(result.upsell)}</dd>
          </div>
        </dl>
        <div>
          <p className="text-sm text-slate-600">{t.total}</p>
          <p className="text-4xl font-bold tracking-tight text-accent">{eur.format(result.total)}</p>
          <p className="mt-1 text-sm text-slate-600">{format(t.roi, { x: result.roi })}</p>
        </div>
        <p className="text-xs text-slate-500">{t.assumption}</p>
      </div>
    </div>
  );
}
