import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { MagicLinkForm } from "@/components/magic-link-form";
import { fr } from "@/i18n/fr";
import { verifyPrefill } from "@/lib/prefill";
import { getOwnStudio } from "@/lib/studio";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Créer ma page" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ prefill?: string }> }) {
  const { prefill: token } = await searchParams;
  const prefill = verifyPrefill(token, process.env.PREFILL_SECRET ?? "");
  const { user, studio } = await getOwnStudio();
  if (studio) redirect("/dashboard");

  const t = fr.onboarding;
  const next = token && prefill ? `/onboarding?prefill=${encodeURIComponent(token)}` : "/onboarding";

  return (
    <main className="min-h-dvh bg-muted px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1.5 text-sm text-slate-600">{t.subtitle}</p>
          {prefill && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-dark">
              <Sparkles className="size-4 shrink-0" aria-hidden /> {t.prefilledNotice}
            </p>
          )}
          <div className="mt-6">
            {user ? (
              <OnboardingForm
                defaults={{
                  name: prefill?.name ?? "",
                  city: prefill?.city ?? "",
                  email: prefill?.email ?? user.email ?? "",
                }}
              />
            ) : (
              <>
                <p className="mb-3 text-sm font-medium">{t.loginFirst}</p>
                <MagicLinkForm next={next} defaultEmail={prefill?.email ?? ""} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
