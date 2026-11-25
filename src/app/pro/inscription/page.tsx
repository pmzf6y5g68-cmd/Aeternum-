import { ReferralCapture } from "@/components/referral-capture";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { MagicLinkForm } from "@/components/magic-link-form";
import { fr } from "@/i18n/fr";
import { verifyPrefill } from "@/lib/prefill";
import { getOwnBusiness } from "@/lib/pro";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Créer ma page professionnelle" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ prefill?: string; parrain?: string }> }) {
  const { prefill: token, parrain } = await searchParams;
  const prefill = verifyPrefill(token, process.env.PREFILL_SECRET ?? "");
  const { user, business } = await getOwnBusiness().catch(() => ({ user: null, business: null }));
  if (business) redirect("/pro/agenda");
  const t = fr.onboarding;
  const next = token && prefill ? `/pro/inscription?prefill=${encodeURIComponent(token)}` : "/pro/inscription";

  return (
    <main className="min-h-dvh bg-canvas px-4 py-10">
      <ReferralCapture code={parrain} />
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t.subtitle}</p>
          {prefill && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-brand-soft px-3.5 py-2.5 text-sm text-brand">
              <Sparkles className="size-4 shrink-0" aria-hidden /> {t.prefilledNotice}
            </p>
          )}
          <div className="mt-6">
            {user ? (
              <OnboardingForm defaults={{ name: prefill?.name ?? "", city: prefill?.city ?? "", email: prefill?.email ?? user.email ?? "", category: prefill?.category ?? null }} />
            ) : (
              <>
                <p className="mb-3 text-sm font-semibold">{t.loginFirst}</p>
                <MagicLinkForm next={next} defaultEmail={prefill?.email ?? ""} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
