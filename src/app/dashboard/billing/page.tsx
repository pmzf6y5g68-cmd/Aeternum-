import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { PostRedirectButton } from "@/components/post-redirect-button";
import { SubmitButton } from "@/components/submit-button";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { countMonthlyBookings, requireStudio } from "@/lib/studio";
import { updateDepositSettings } from "../actions";

const t = fr.dashboard.billing;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const { supabase, studio } = await requireStudio();
  const used = await countMonthlyBookings(supabase, studio.id);
  const limit = siteConfig.pricing.freeMonthlyBookings;
  const isPro = studio.plan === "pro";
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
      {checkout === "success" && <p className="card border-accent/30 bg-accent-soft/40 text-sm">{t.checkoutSuccess}</p>}

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <CreditCard className="size-4 text-accent" aria-hidden /> {isPro ? t.planPro : t.planFree}
          </h2>
          {isPro && <BadgeCheck className="size-5 text-accent" aria-label={t.planPro} />}
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">{t.quota}</span>
            <span className="font-semibold">{isPro ? `${used} · ${t.unlimited}` : `${used} / ${limit}`}</span>
          </div>
          {!isPro && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {isPro ? (
          <PostRedirectButton endpoint="/api/stripe/portal" label={t.portal} className="btn-secondary" errorLabel={fr.common.error} />
        ) : (
          <PostRedirectButton endpoint="/api/stripe/subscription" label={t.upgrade} errorLabel={fr.common.error} />
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4 text-accent" aria-hidden /> {t.connectTitle}
        </h2>
        <p className="text-sm text-slate-600">{t.connectText}</p>
        {studio.stripe_connect_onboarded ? (
          <>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              <BadgeCheck className="size-4" aria-hidden /> {t.connectDone}
            </p>
            <form action={updateDepositSettings} className="flex flex-wrap items-end gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="deposit_enabled" defaultChecked={studio.deposit_enabled} className="size-4 accent-[#0F766E]" />
                {t.depositEnabled}
              </label>
              <div className="w-32">
                <label className="label">{t.depositPercent}</label>
                <input name="deposit_percent" type="number" min={5} max={100} step={5} defaultValue={studio.deposit_percent} className="input" />
              </div>
              <SubmitButton>{fr.common.save}</SubmitButton>
            </form>
          </>
        ) : (
          <PostRedirectButton
            endpoint="/api/stripe/connect"
            label={studio.stripe_connect_account_id ? t.connectPending : t.connectCta}
            errorLabel={fr.common.error}
          />
        )}
      </section>
    </div>
  );
}
