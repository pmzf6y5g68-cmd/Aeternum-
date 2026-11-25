import Link from "next/link";
import { BellRing, CalendarClock, Check, History, Search, Scale, CalendarCheck2 } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { SearchBar } from "@/components/search-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CATEGORIES, CATEGORY_BY_SLUG, FEATURED_CATEGORIES, GROUPS } from "@/config/categories";
import { fr } from "@/i18n/fr";

const t = fr.home;
const howIcons = [Search, Scale, CalendarCheck2];
const benefitIcons = [CalendarClock, BellRing, History];

export default function HomePage() {
  const featured = FEATURED_CATEGORIES.map((s) => CATEGORY_BY_SLUG.get(s)).filter((c) => c !== undefined);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-brand pb-16 pt-10 md:pb-24 md:pt-16">
          <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-brand-dark/40" />
          <div className="relative mx-auto max-w-5xl px-4">
            <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-base text-white/85 md:text-lg">{t.subtitle}</p>
            <div className="mt-8">
              <SearchBar />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-white/80">{t.popular} :</span>
              {featured.slice(0, 8).map((c) => (
                <Link key={c.slug} href={`/${c.slug}`} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20">
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {featured.map((c) => (
              <Link key={c.slug} href={`/${c.slug}`} className="card flex flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:border-brand">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <CategoryIcon name={c.icon} className="size-5" />
                </span>
                <span className="text-sm font-semibold leading-tight">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t.universes}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((g) => {
              const cats = CATEGORIES.filter((c) => c.group === g.slug);
              return (
                <div key={g.slug} className="card">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-brand text-white">
                      <CategoryIcon name={g.icon} className="size-5" />
                    </span>
                    <h3 className="text-lg font-bold">{g.label}</h3>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {cats.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/${c.slug}`} className="chip">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">{t.howTitle}</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {t.how.map((step, i) => {
                const Icon = howIcons[i] ?? Check;
                return (
                  <li key={step.title} className="text-center">
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-bold">
                      {i + 1}. {step.title}
                    </h3>
                    <p className="mt-1.5 text-ink-soft">{step.text}</p>
                  </li>
                );
              })}
            </ol>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {t.benefits.map((b, i) => {
                const Icon = benefitIcons[i] ?? Check;
                return (
                  <div key={b.title} className="flex gap-3 rounded-xl bg-canvas p-5">
                    <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                    <div>
                      <p className="font-semibold">{b.title}</p>
                      <p className="text-sm text-ink-soft">{b.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-16">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-brand-deep p-8 text-white md:flex-row md:items-center md:justify-between md:p-12">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold md:text-3xl">{t.proTitle}</h2>
              <p className="mt-3 text-white/85">{t.proText}</p>
            </div>
            <Link href="/pro" className="btn-sun shrink-0 px-6 py-3.5 text-base">
              {t.proCta}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
