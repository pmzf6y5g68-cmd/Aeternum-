import Link from "next/link";
import { ExternalLink, Gift } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { formatEur, eurToCents } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import type { GiftCard } from "@/lib/gift-cards";
import { requireBusiness } from "@/lib/pro";
import { RedeemForm } from "./redeem-form";

export const metadata = { title: "Cartes cadeaux" };

const STATUS: Record<GiftCard["status"], { label: string; className: string }> = {
  pending: { label: "Paiement en cours", className: "bg-canvas text-ink-soft" },
  active: { label: "Valable", className: "bg-green-50 text-success" },
  redeemed: { label: "Utilisée", className: "bg-brand-soft text-brand" },
  cancelled: { label: "Annulée", className: "bg-canvas text-ink-soft" },
};

export default async function GiftCardsPage() {
  const { supabase, business } = await requireBusiness();
  const { data: cards } = await supabase.from("gift_cards").select("*").eq("business_id", business.id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(200).returns<GiftCard[]>();
  const sold = (cards ?? []).filter((c) => c.status === "active" || c.status === "redeemed");
  const total = sold.reduce((s, c) => s + eurToCents(c.amount_eur), 0);
  const outstanding = sold.filter((c) => c.status === "active").reduce((s, c) => s + eurToCents(c.amount_eur), 0);
  const link = `${env.appUrl()}/carte-cadeau/${business.slug}`;
  const enabled = business.gift_cards_enabled && business.stripe_connect_onboarded;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cartes cadeaux</h1>
        <p className="text-sm text-ink-soft">Vendez en ligne, encaissez tout de suite, gagnez de nouveaux clients.</p>
      </div>

      {!enabled ? (
        <section className="card">
          <p className="flex items-center gap-2 font-semibold">
            <Gift className="size-5 text-brand" aria-hidden /> Les cartes cadeaux ne sont pas encore activées.
          </p>
          <p className="mt-1 text-sm text-ink-soft">Activez le paiement en ligne puis cochez « Vendre des cartes cadeaux ».</p>
          <Link href="/pro/abonnement" className="btn-primary mt-4">
            Activer
          </Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Vendu</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatEur(total)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cartes vendues</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{sold.length}</p>
            </div>
            <div className="card col-span-2 p-4 md:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">À honorer</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatEur(outstanding)}</p>
            </div>
          </section>
          <section className="card">
            <h2 className="font-bold">Valider une carte</h2>
            <p className="mb-3 text-sm text-ink-soft">Le jour du rendez-vous, saisissez le code présenté par le client.</p>
            <RedeemForm />
          </section>
          <section className="card">
            <h2 className="font-bold">Votre page de vente</h2>
            <p className="mt-1 text-sm text-ink-soft">À partager avant les fêtes, la Saint-Valentin ou la fête des mères, sur vos réseaux et en vitrine.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={link} className="input font-medium" aria-label="Lien de vente" />
              <CopyButton value={link} />
              <Link href={`/carte-cadeau/${business.slug}`} target="_blank" className="btn-secondary">
                <ExternalLink className="size-4" aria-hidden /> Voir
              </Link>
            </div>
          </section>
          <section className="card">
            <h2 className="font-bold">Historique</h2>
            {(cards ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Aucune carte vendue pour l&apos;instant.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {(cards ?? []).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {formatEur(eurToCents(c.amount_eur))} · pour {c.recipient_name}
                      </p>
                      <p className="text-ink-soft">
                        de {c.buyer_name} · <span className="font-mono">{c.code}</span>
                        {c.expires_at && c.status === "active" ? ` · jusqu'au ${new Intl.DateTimeFormat("fr-FR").format(new Date(c.expires_at))}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
