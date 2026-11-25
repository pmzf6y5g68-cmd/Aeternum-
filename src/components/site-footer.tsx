import Link from "next/link";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";

export function SiteFooter() {
  const t = fr.landing.footer;
  return (
    <footer className="border-t border-slate-200 bg-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.legal.companyName} — {siteConfig.supportEmail}
        </p>
        <nav className="flex gap-5">
          <Link href="/mentions-legales" className="hover:text-ink">
            {t.legal}
          </Link>
          <Link href="/cgu" className="hover:text-ink">
            {t.terms}
          </Link>
          <Link href="/confidentialite" className="hover:text-ink">
            {t.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
