import { ReferralCapture } from "@/components/referral-capture";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { MagicLinkForm } from "@/components/magic-link-form";
import { fr } from "@/i18n/fr";
import { verifyPrefill } from "@/lib/prefill";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnBusiness } from "@/lib/pro";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Créer ma page professionnelle" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ prefill?: string; parrain?: string; fiche?: string }> }) {
  const { prefill: token, parrain, fiche } = await searchParams;
  const signed = verifyPrefill(token, process.env.PREFILL_SECRET ?? "");
  // Revendication d'une fiche de l'annuaire ouvert : nom, métier et ville déjà remplis.
  const listing =
    !signed && fiche && /^[0-9a-f-]{36}$/.test(fiche)
      ? (await createAdminClient().from("directory_listings").select("id, name, category, city").eq("id", fiche).is("claimed_business_id", null).maybeSingle<{ id: string; name: string; category: string; city: string | null }>()).data
      : null;
  const prefill = signed ?? (listing ? { name: listing.name, city: listing.city ?? "", email: "", category: listing.category } : null);
  const { user, business } = await getOwnBusiness().catch(() => ({ user: null, business: null }));
  if (business) redirect("/pro/agenda");
  const t = fr.onboarding;
  const next = token && signed ? `/pro/inscription?prefill=${encodeURIComponent(token)}` : listing ? `/pro/inscription?fiche=${listing.id}` : "/pro/inscription";

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
              <OnboardingForm defaults={{ name: prefill?.name ?? "", city: prefill?.city ?? "", email: prefill?.email ?? user.email ?? "", category: prefill?.category ?? null }} listingId={listing?.id ?? null} />
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
