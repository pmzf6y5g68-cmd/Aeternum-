import Link from "next/link";
import { CATEGORIES, GROUPS } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-1">
          <Logo tone="light" />
          <p className="text-sm">{siteConfig.tagline}.</p>
          <Link href="/pro" className="btn-sun mt-2 text-sm">
            {fr.common.forPros}
          </Link>
        </div>
        {GROUPS.slice(0, 8).map((g) => (
          <div key={g.slug}>
            <p className="mb-2 text-sm font-semibold text-white">{g.label}</p>
            <ul className="space-y-1.5 text-sm">
              {CATEGORIES.filter((c) => c.group === g.slug)
                .slice(0, 5)
                .map((c) => (
                  <li key={c.slug}>
                    <Link href={`/${c.slug}`} className="hover:text-white">
                      {c.plural}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.legal.companyName} — {siteConfig.supportEmail}
          </p>
          <nav className="flex gap-5">
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-white">CGU</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
