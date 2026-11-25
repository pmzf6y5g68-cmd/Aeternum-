import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarRange, Check, Eye, Layers, ShieldCheck, Users } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { SiteFooter } from "@/components/site-footer";
import { PlanPicker } from "@/components/plan-picker";
import { SiteHeader } from "@/components/site-header";
import { CATEGORIES } from "@/config/categories";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = {
  title: "Logiciel de prise de rendez-vous en ligne pour professionnels",
  description: "Page de réservation, agenda d'équipe, rappels, acomptes anti-absence et visibilité auprès de milliers de clients. Gratuit pour démarrer.",
};

const t = fr.pro;
const icons = [Eye, CalendarRange, ShieldCheck, Layers, Users, BellRing];

export default function ProLandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-brand pb-16 pt-10 md:pt-16">
          <div className="mx-auto max-w-5xl px-4 text-white">
            <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{t.badge}</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/85">{t.subtitle}</p>
            <Link href="/pro/inscription" className="btn-sun mt-8 px-7 py-3.5 text-base">
              {t.cta}
            </Link>
            <div className="mt-10 flex flex-wrap gap-2">
              {CATEGORIES.slice(0, 24).map((c) => (
                <span key={c.slug} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm">
                  <CategoryIcon name={c.icon} className="size-3.5" /> {c.label}
                </span>
              ))}
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm">+ {CATEGORIES.length - 24} métiers</span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const Icon = icons[i] ?? Check;
              return (
                <div key={f.title} className="card">
                  <Icon className="size-6 text-brand" aria-hidden />
                  <h2 className="mt-3 font-bold">{f.title}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold md:text-3xl">{t.pricingTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-ink-soft">
            Prix public, sans devis, sans frais d&apos;installation, sans engagement et <strong>sans aucune commission</strong> sur vos rendez-vous. Gratuit pour vos clients, toujours.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="card flex flex-col p-7">
              <h3 className="text-lg font-bold">{t.freeName}</h3>
              <p className="mt-2 text-4xl font-bold">{t.freePrice}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {t.freeFeatures.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-brand" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/pro/inscription" className="btn-secondary mt-7">
                {t.start}
              </Link>
            </div>
            <div className="card flex flex-col border-brand p-7 ring-2 ring-brand">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{t.proName}</h3>
                <span className="rounded-full bg-sun px-2.5 py-1 text-xs font-bold text-ink">{t.proBadge}</span>
              </div>
              <div className="mt-3">
                <PlanPicker mode="simulator" />
              </div>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {t.proFeatures.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-brand" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/pro/inscription" className="btn-primary mt-7">
                {t.start}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
