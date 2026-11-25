import Link from "next/link";
import { Bell, Car, Check, CreditCard, MapPin, QrCode, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { RevenueCalculator } from "@/components/revenue-calculator";
import { SiteFooter } from "@/components/site-footer";
import { fr } from "@/i18n/fr";

const t = fr.landing;
const stepIcons = [MapPin, Car, Sparkles, CreditCard];
const featureIcons = [ShieldCheck, Bell, RefreshCcw, QrCode];

export default function LandingPage() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">
              {fr.common.login}
            </Link>
            <Link href="/onboarding" className="btn-primary hidden sm:inline-flex">
              {fr.common.startFree}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-muted to-white">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 md:pt-24">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-dark">{t.badge}</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">{t.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{t.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboarding" className="btn-primary px-6 py-3.5 text-base">
                {fr.common.startFree}
              </Link>
              <a href="#parcours" className="btn-secondary px-6 py-3.5 text-base">
                {t.secondaryCta}
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              {t.proof.map((p) => (
                <li key={p} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-accent" aria-hidden /> {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t.calculator.title}</h2>
          <p className="mt-2 text-slate-600">{t.calculator.subtitle}</p>
          <div className="mt-8">
            <RevenueCalculator />
          </div>
        </section>

        <section id="parcours" className="bg-muted">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t.funnel.title}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {t.funnel.steps.map((step, i) => {
                const Icon = stepIcons[i] ?? Check;
                return (
                  <li key={step.title} className="card">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                      <Icon className="size-5 text-accent" aria-hidden />
                    </div>
                    <h3 className="mt-4 font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t.features.title}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {t.features.items.map((f, i) => {
              const Icon = featureIcons[i] ?? Check;
              return (
                <div key={f.title} className="card flex gap-4">
                  <Icon className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden />
                  <div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="tarifs" className="bg-muted">
          <div className="mx-auto max-w-4xl px-4 py-16">
            <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">{t.pricing.title}</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="card flex flex-col p-7">
                <h3 className="text-lg font-semibold">{t.pricing.freeName}</h3>
                <p className="mt-2 text-4xl font-bold">{t.pricing.freePrice}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {t.pricing.freeFeatures.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-accent" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/onboarding" className="btn-secondary mt-7">
                  {t.pricing.cta}
                </Link>
              </div>
              <div className="card flex flex-col border-accent p-7 ring-2 ring-accent">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t.pricing.proName}</h3>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-dark">{t.pricing.proBadge}</span>
                </div>
                <p className="mt-2 text-4xl font-bold">
                  {t.pricing.proPrice}
                  <span className="text-base font-medium text-slate-500">{fr.common.perMonth}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {t.pricing.proFeatures.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-accent" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/onboarding" className="btn-primary mt-7">
                  {t.pricing.cta}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
