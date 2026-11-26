import Link from "next/link";
import { Ticket } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { eurToCents, formatEur, startingPriceCents } from "@/lib/domain/pricing";
import { perSessionCents, type ClientPack, type Pack } from "@/lib/packs";
import { requireBusiness } from "@/lib/pro";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Service } from "@/lib/supabase/types";
import { createPack, togglePack } from "../actions";

const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** Carnets de séances : un client fidèle paie d'avance, vous encaissez tout de suite. */
export default async function PacksAdminPage() {
  const { business } = await requireBusiness();
  const admin = createAdminClient();
  const [{ data: services }, { data: packs }, { data: sold }] = await Promise.all([
    admin.from("services").select("*").eq("business_id", business.id).eq("active", true).order("sort").returns<Service[]>(),
    admin.from("packs").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).returns<Pack[]>(),
    admin.from("client_packs").select("*").eq("business_id", business.id).eq("status", "active").order("created_at", { ascending: false }).limit(100).returns<ClientPack[]>(),
  ]);
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const revenue = (sold ?? []).reduce((sum, c) => sum + eurToCents(c.price_eur), 0);
  const first = services?.[0];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Carnets de séances</h1>
      {!business.stripe_connect_onboarded && (
        <p className="card border-amber-200 bg-amber-50 text-sm">
          Activez d&apos;abord les paiements en ligne dans{" "}
          <Link href="/pro/abonnement" className="font-semibold text-brand underline">
            Abonnement et paiements
          </Link>{" "}
          : l&apos;argent des carnets arrive directement sur votre compte, sans commission.
        </p>
      )}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card">
          <p className="text-sm text-ink-soft">Carnets actifs vendus</p>
          <p className="mt-1 text-2xl font-bold">{sold?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-soft">Encaissé d&apos;avance</p>
          <p className="mt-1 text-2xl font-bold">{formatEur(revenue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-soft">Séances restant à honorer</p>
          <p className="mt-1 text-2xl font-bold">{(sold ?? []).reduce((s, c) => s + c.sessions_left, 0)}</p>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-bold">
          <Ticket className="size-4 text-brand" aria-hidden /> Créer un carnet
        </h2>
        {first ? (
          <form action={createPack} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="service_id">Prestation</label>
              <select id="service_id" name="service_id" className="input" defaultValue={first.id}>
                {(services ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatEur(startingPriceCents(s))}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="name">Nom affiché</label>
              <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={`Carnet 10 × ${first.name}`} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="sessions">Séances</label>
              <input id="sessions" name="sessions" type="number" min={2} max={50} defaultValue={10} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="price_eur">Prix total (€)</label>
              <input id="price_eur" name="price_eur" type="number" min={5} max={5000} step="0.5" defaultValue={Math.round((startingPriceCents(first) * 9) / 100)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="validity_days">Validité</label>
              <select id="validity_days" name="validity_days" defaultValue={365} className="input">
                <option value={90}>3 mois</option>
                <option value={180}>6 mois</option>
                <option value={365}>1 an</option>
                <option value={730}>2 ans</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <SubmitButton className="btn-primary w-full">Mettre en vente</SubmitButton>
            </div>
            <p className="text-xs text-ink-soft sm:col-span-2 lg:col-span-5">Conseil : 10 séances au prix de 9 se vendent le mieux. Le client réserve chaque séance avec son code ; une annulation dans les délais lui rend la séance.</p>
          </form>
        ) : (
          <p className="text-sm text-ink-soft">
            Ajoutez d&apos;abord une prestation dans{" "}
            <Link href="/pro/prestations" className="font-semibold text-brand underline">
              Prestations
            </Link>
            .
          </p>
        )}
      </section>

      {packs && packs.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">Vos carnets</h2>
            <Link href={`/carnet/${business.slug}`} className="text-sm font-semibold text-brand">
              Voir la page de vente →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {packs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className={`block font-semibold ${p.active ? "" : "text-ink-soft line-through"}`}>{p.name}</span>
                  <span className="text-sm text-ink-soft">
                    {p.sessions} × {serviceName.get(p.service_id) ?? "prestation supprimée"} · {formatEur(eurToCents(p.price_eur))} ({formatEur(perSessionCents(p))} la séance)
                  </span>
                </span>
                <form action={togglePack}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                  <SubmitButton className="btn-secondary px-3 py-1.5 text-sm">{p.active ? "Retirer de la vente" : "Remettre en vente"}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sold && sold.length > 0 && (
        <section className="card">
          <h2 className="font-bold">Clients avec un carnet</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {sold.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>
                  <span className="font-semibold">{c.buyer_name}</span> · {c.name}
                </span>
                <span className="text-ink-soft">
                  {c.sessions_left}/{c.sessions_total} séances restantes{c.expires_at ? ` · jusqu'au ${dateFr(c.expires_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
