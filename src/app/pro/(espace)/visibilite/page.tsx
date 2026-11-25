import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Circle, Eye, Globe2, Percent, Search, Wallet } from "lucide-react";
import { formatEur } from "@/lib/domain/pricing";
import { requireBusiness, shareBusinessUrl } from "@/lib/pro";
import { conversionRate, visibilityChecks, visibilityScore } from "@/lib/visibility";
import type { OpeningHoursRow, Service } from "@/lib/supabase/types";
import { AiWriter } from "./ai-writer";

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
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
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
