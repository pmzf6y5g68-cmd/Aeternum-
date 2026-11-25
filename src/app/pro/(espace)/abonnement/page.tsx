import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { PostRedirectButton } from "@/components/post-redirect-button";
import { SubmitButton } from "@/components/submit-button";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { countMonthlyBookings, requireBusiness } from "@/lib/pro";
import { updateDepositSettings } from "../actions";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const { supabase, business } = await requireBusiness();
  const used = await countMonthlyBookings(supabase, business.id);
  const limit = siteConfig.pricing.freeMonthlyBookings;
  const isPro = business.plan === "pro";
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const { data: commissions } = await supabase
    .from("bookings")
    .select("commission_eur, commission_invoiced, status")
    .eq("business_id", business.id)
    .gt("commission_eur", 0)
    .neq("status", "cancelled")
    .eq("commission_invoiced", false)
    .returns<{ commission_eur: number; commission_invoiced: boolean; status: string }[]>();
  const pendingCommission = (commissions ?? []).filter((c) => c.status === "completed").reduce((s, c) => s + Number(c.commission_eur), 0);
  const upcomingCommission = (commissions ?? []).filter((c) => c.status !== "completed" && c.status !== "no_show").reduce((s, c) => s + Number(c.commission_eur), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.billing}</h1>
      {checkout === "success" && <p className="card border-green-200 bg-green-50 text-sm font-semibold text-success">Merci ! Votre abonnement Pro est actif.</p>}
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold">
            <CreditCard className="size-4 text-brand" aria-hidden /> {isPro ? "Plan Pro" : "Plan Gratuit"}
          </h2>
          {isPro && <BadgeCheck className="size-5 text-brand" aria-label="Pro" />}
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">Rendez-vous ce mois-ci</span>
            <span className="font-bold">{isPro ? `${used} · illimité` : `${used} / ${limit}`}</span>
          </div>
          {!isPro && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-danger" : "bg-brand"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {!isPro && (
          <div className="rounded-lg bg-canvas p-3 text-sm">
            <p className="font-semibold">
              Commissions nouveaux clients : {pendingCommission.toFixed(2).replace(".", ",")} € à facturer · {upcomingCommission.toFixed(2).replace(".", ",")} € sur des RDV à venir
            </p>
            <p className="mt-1 text-ink-soft">
              Plan Gratuit : {siteConfig.pricing.newClientCommissionPercent} % du premier rendez-vous honoré d&apos;un nouveau client venu de Rendez-vous (max {siteConfig.pricing.newClientCommissionCapEur} €). Vos propres clients (lien ?via=pro, QR code) : 0 %. Plan Pro : 0 % sur tout.
            </p>
          </div>
        )}
        {isPro ? (
          <PostRedirectButton endpoint="/api/stripe/portal" label="Gérer mon abonnement" className="btn-secondary" />
        ) : (
          <>
            <ul className="grid gap-1 text-sm text-ink-soft sm:grid-cols-2">
              {fr.pro.proFeatures.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <PostRedirectButton endpoint="/api/stripe/subscription" label={`Passer Pro — ${siteConfig.pricing.proTrialDays} jours offerts`} />
          </>
        )}
      </section>
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4 text-brand" aria-hidden /> Acomptes anti-absence
        </h2>
        <p className="text-sm text-ink-soft">Les acomptes sont versés directement sur votre propre compte Stripe : Rendez-vous ne touche jamais votre argent.</p>
        {business.stripe_connect_onboarded ? (
          <form action={updateDepositSettings} className="flex flex-wrap items-end gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="deposit_enabled" defaultChecked={business.deposit_enabled} className="size-4 accent-[#1758E6]" /> Demander un acompte
            </label>
            <div className="w-32">
              <label className="label">Pourcentage</label>
              <input name="deposit_percent" type="number" min={5} max={100} step={5} defaultValue={business.deposit_percent} className="input" />
            </div>
            <SubmitButton>{fr.common.save}</SubmitButton>
          </form>
        ) : (
          <PostRedirectButton endpoint="/api/stripe/connect" label={business.stripe_connect_account_id ? "Finaliser mon compte Stripe" : "Activer les acomptes avec Stripe"} />
        )}
      </section>
    </div>
  );
}
