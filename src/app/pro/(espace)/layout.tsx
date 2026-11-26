import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { fr } from "@/i18n/fr";
import { signOut } from "@/lib/auth-actions";
import { requireBusiness } from "@/lib/pro";
import { businessPath } from "@/lib/slug";
import { ProNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const { business } = await requireBusiness();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo href="/pro/agenda" />
            <span className="hidden rounded bg-brand-soft px-2 py-0.5 text-xs font-bold uppercase text-brand sm:inline">Pro</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href={businessPath(business)} target="_blank" className="btn-ghost hidden px-3 text-sm sm:inline-flex">
              {business.name} <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${business.plan === "pro" ? "bg-sun text-[#0b1f3a]" : "bg-canvas text-ink-soft"}`}>{business.plan}</span>
            <form action={signOut}>
              <button type="submit" className="btn-ghost px-3" aria-label={fr.common.logout}>
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside>
          <ProNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
