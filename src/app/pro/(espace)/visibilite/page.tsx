import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Circle, Eye, Globe2, Percent, Search, Wallet } from "lucide-react";
import { formatEur } from "@/lib/domain/pricing";
import { requireBusiness, shareBusinessUrl } from "@/lib/pro";
import { conversionRate, visibilityChecks, visibilityScore } from "@/lib/visibility";
import type { OpeningHoursRow, Service } from "@/lib/supabase/types";

const DAYS: [number, string][] = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [0, "Dim"]];
import { AiWriter } from "./ai-writer";
import { SubmitButton } from "@/components/submit-button";
import { updateOffers } from "../actions";

export const metadata = { title: "Visibilité" };

const DAY = 86_400_000;

function scoreTone(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-amber-600";
  return "text-danger";
}

export default async function VisibilityPage() {
  const { supabase, business } = await requireBusiness();
  const since = new Date(Date.now() - 30 * DAY);
  const [{ data: services }, { data: hours }, { data: daily }, { data: bookings }] = await Promise.all([
    supabase.from("services").select("*").eq("business_id", business.id).returns<Service[]>(),
    supabase.from("opening_hours").select("*").eq("business_id", business.id).returns<OpeningHoursRow[]>(),
    supabase.from("business_daily_stats").select("day, views, widget_views").eq("business_id", business.id).gte("day", since.toISOString().slice(0, 10)).returns<{ day: string; views: number; widget_views: number }[]>(),
    supabase.from("bookings").select("source, total_price_eur, status").eq("business_id", business.id).gte("created_at", since.toISOString()).returns<{ source: string; total_price_eur: number; status: string }[]>(),
  ]);

  const checks = visibilityChecks({ business, services: services ?? [], hours: hours ?? [] });
  const score = visibilityScore(checks);
  const kept = (bookings ?? []).filter((b) => !["cancelled", "pending_deposit"].includes(b.status));
  const stats = {
    views: (daily ?? []).reduce((s, d) => s + d.views, 0),
    widgetViews: (daily ?? []).reduce((s, d) => s + d.widget_views, 0),
    bookings: kept.length,
    marketplaceBookings: kept.filter((b) => b.source !== "direct").length,
    revenueEur: kept.reduce((s, b) => s + Number(b.total_price_eur), 0),
  };
  const rate = conversionRate(stats);
  const url = shareBusinessUrl(business);
  const todo = checks.filter((c) => !c.done).sort((a, b) => b.points - a.points);

  const tiles = [
    { icon: Eye, label: "Vues de votre page", value: String(stats.views + stats.widgetViews), sub: stats.widgetViews ? `dont ${stats.widgetViews} depuis votre site` : "30 derniers jours" },
    { icon: CalendarCheck, label: "Réservations", value: String(stats.bookings), sub: `${stats.marketplaceBookings} via Rendez-vous` },
    { icon: Percent, label: "Taux de réservation", value: rate === null ? "—" : `${String(rate).replace(".", ",")} %`, sub: "vues → rendez-vous" },
    { icon: Wallet, label: "Chiffre d'affaires réservé", value: formatEur(Math.round(stats.revenueEur * 100)), sub: "30 derniers jours" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visibilité</h1>
        <p className="text-sm text-ink-soft">Votre présence sur Rendez-vous, Google, Google Maps et les assistants de recherche.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
              <Icon className="size-4 text-brand" aria-hidden /> {label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-ink-soft">{sub}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Score de visibilité</h2>
            <p className="text-sm text-ink-soft">Plus il est haut, plus vous remontez dans la recherche et sur Google.</p>
          </div>
          <p className={`text-4xl font-bold tabular-nums ${scoreTone(score)}`}>
            {score}
            <span className="text-lg text-ink-soft">/100</span>
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${score}%` }} />
        </div>
        <ul className="mt-5 divide-y divide-line">
          {[...todo, ...checks.filter((c) => c.done)].map((c) => (
            <li key={c.key} className="flex items-start gap-3 py-3">
              {c.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-line" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${c.done ? "text-ink-soft" : ""}`}>{c.label}</p>
                {!c.done && <p className="text-sm text-ink-soft">{c.hint}</p>}
              </div>
              {!c.done && (
                <Link href={c.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  +{c.points} <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section id="offres" className="card scroll-mt-24 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Percent className="size-4 text-brand" aria-hidden /> Remplir les heures creuses et fidéliser
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Une remise sur vos créneaux calmes ou de dernière minute : ils s&apos;affichent avec un badge « −20 % » et passent en tête quand un client cherche une promo. La remise est calculée automatiquement à la réservation, jamais sur les frais de déplacement.
          </p>
        </div>
        <form action={updateOffers} className="space-y-4">
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">Heures creuses</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAYS.map(([d, label]) => (
                <label key={d} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand">
                  <input type="checkbox" name="offpeak_days" value={d} defaultChecked={business.offpeak_days.includes(d)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="offpeak_start">De</label>
                <input id="offpeak_start" name="offpeak_start" type="time" defaultValue={business.offpeak_start?.slice(0, 5) ?? "14:00"} className="input w-32" />
              </div>
              <div>
                <label className="label" htmlFor="offpeak_end">À</label>
                <input id="offpeak_end" name="offpeak_end" type="time" defaultValue={business.offpeak_end?.slice(0, 5) ?? "16:00"} className="input w-32" />
              </div>
              <div>
                <label className="label" htmlFor="offpeak_percent">Remise</label>
                <div className="relative w-28">
                  <input id="offpeak_percent" name="offpeak_percent" type="number" min={0} max={50} step={5} defaultValue={business.offpeak_percent} className="input pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Dernière minute</p>
              <p className="mt-1 text-xs text-ink-soft">Pour les créneaux encore libres peu avant l&apos;heure : mieux vaut un client à −20 % qu&apos;un fauteuil vide.</p>
            </div>
            <div>
              <label className="label" htmlFor="lastminute_hours">Moins de</label>
              <div className="relative w-28">
                <input id="lastminute_hours" name="lastminute_hours" type="number" min={1} max={72} defaultValue={business.lastminute_hours} className="input pr-8" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">h</span>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="lastminute_percent">Remise</label>
              <div className="relative w-28">
                <input id="lastminute_percent" name="lastminute_percent" type="number" min={0} max={50} step={5} defaultValue={business.lastminute_percent} className="input pr-8" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">%</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Fidélité</p>
              <p className="mt-1 text-xs text-ink-soft">Récompensez les habitués automatiquement : la remise s&apos;applique d&apos;elle-même à la bonne visite, et le client voit sa progression dans son compte.</p>
            </div>
            <div>
              <label className="label" htmlFor="loyalty_every">Toutes les</label>
              <select id="loyalty_every" name="loyalty_every" defaultValue={business.loyalty_every} className="input w-36">
                <option value={0}>Désactivée</option>
                {[5, 6, 8, 10, 12].map((v) => (
                  <option key={v} value={v}>
                    {v} visites
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="loyalty_percent">Remise</label>
              <select id="loyalty_percent" name="loyalty_percent" defaultValue={business.loyalty_percent || 50} className="input w-36">
                {[20, 30, 50, 100].map((v) => (
                  <option key={v} value={v}>
                    {v === 100 ? "Offerte" : `−${v} %`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-soft">0 % = offre désactivée. Maximum 50 %. Les deux remises ne se cumulent jamais.</p>
            <SubmitButton className="btn-primary">Enregistrer</SubmitButton>
          </div>
        </form>
      </section>
      <section id="ia" className="card scroll-mt-24">
        <h2 className="text-lg font-bold">Rédaction de votre fiche</h2>
        <p className="mb-4 text-sm text-ink-soft">Un texte complet, construit à partir de vos prestations, prix, horaires et lieux, écrit pour être trouvé sur Google et repris par les assistants de recherche. Vous relisez avant de publier.</p>
        <AiWriter />
      </section>

      <section className="card">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Globe2 className="size-5 text-brand" aria-hidden /> Être trouvé sur Google
        </h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-semibold">Fiche Google Business :</span> Modifier le profil › Réservations › ajoutez votre lien :
            <code className="ml-1 break-all rounded bg-canvas px-1.5 py-0.5">{url}</code>. Le bouton « Prendre rendez-vous » apparaît dans Google Maps.
          </li>
          <li>
            <span className="font-semibold">Votre site web :</span> ajoutez le{" "}
            <Link href="/pro/partager#widget" className="font-semibold text-brand hover:underline">
              module de réservation
            </Link>{" "}
            : vos visiteurs réservent sans quitter votre site.
          </li>
          <li>
            <span className="font-semibold">Avis :</span> chaque client venu reçoit automatiquement une demande d&apos;avis. Répondez-y depuis{" "}
            <Link href="/pro/avis" className="font-semibold text-brand hover:underline">
              Avis
            </Link>{" "}
              : les réponses comptent pour Google.
          </li>
          <li>
            <span className="font-semibold">Automatique :</span> votre page est déclarée à Google et Bing à chaque modification, avec données structurées (prix, horaires, avis, FAQ) et plan du site.
          </li>
        </ol>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
          <Search className="size-3.5" aria-hidden /> Les vues sont comptées sans cookie ni donnée personnelle ; les robots sont exclus.
        </p>
      </section>
    </div>
  );
}
