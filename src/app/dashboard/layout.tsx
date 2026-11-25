import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { fr } from "@/i18n/fr";
import { signOut } from "@/lib/auth-actions";
import { requireStudio } from "@/lib/studio";
import { DashboardNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { studio } = await requireStudio();
  return (
    <div className="min-h-dvh bg-muted">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-1">
            <Link href={`/${studio.slug}`} target="_blank" className="btn-ghost hidden px-3 text-sm sm:inline-flex">
              {studio.name} <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-semibold uppercase text-slate-600 sm:inline">{studio.plan}</span>
            <form action={signOut}>
              <button type="submit" className="btn-ghost px-3" aria-label={fr.common.logout}>
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside>
          <DashboardNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
