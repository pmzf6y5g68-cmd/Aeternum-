import Link from "next/link";
import { CalendarDays, UserRound } from "lucide-react";
import { fr } from "@/i18n/fr";
import { getCurrentUser } from "@/lib/supabase/server";
import { Logo } from "./logo";
import { SearchBar, type SearchBarProps } from "./search-bar";

/** En-tête public. `search` affiche la barre de recherche compacte (pages de résultats et fiches). */
export async function SiteHeader({ search, variant = "brand" }: { search?: SearchBarProps; variant?: "brand" | "white" }) {
  const { user } = await getCurrentUser().catch(() => ({ user: null }));
  const light = variant === "brand";
  return (
    <header className={`${light ? "bg-brand" : "border-b border-line bg-white"} sticky top-0 z-30`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap md:gap-6">
        <Logo tone={light ? "light" : "dark"} />
        {search && (
          <div className="order-3 w-full md:order-none md:max-w-3xl md:flex-1">
            <SearchBar {...search} size="md" />
          </div>
        )}
        <nav className="ml-auto flex items-center gap-1">
          <Link href="/pro" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold lg:inline-flex ${light ? "text-white/90 hover:bg-white/10" : "text-ink-soft hover:text-brand"}`}>
            {fr.common.forPros}
          </Link>
          <Link
            href={user ? "/compte" : "/login?next=/compte"}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${light ? "bg-white/10 text-white hover:bg-white/20" : "bg-brand-soft text-brand hover:bg-brand hover:text-white"}`}
          >
            {user ? <CalendarDays className="size-4" aria-hidden /> : <UserRound className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{user ? fr.common.myAppointments : fr.common.login}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
