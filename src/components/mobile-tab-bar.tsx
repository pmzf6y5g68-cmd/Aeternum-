"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Heart, House, Search } from "lucide-react";
import { mobileBar } from "@/lib/mobile-chrome";

const TABS = [
  { href: "/", label: "Accueil", icon: House, match: (p: string) => p === "/" },
  { href: "/recherche", label: "Rechercher", icon: Search, match: (p: string) => p.startsWith("/recherche") },
  { href: "/compte", label: "Rendez-vous", icon: CalendarDays, match: (p: string) => p === "/compte" },
  { href: "/compte/favoris", label: "Favoris", icon: Heart, match: (p: string) => p.startsWith("/compte/favoris") },
];

/** Barre d'onglets mobile : les 4 destinations de l'usager toujours sous le pouce. */
export function MobileTabBar() {
  const pathname = usePathname();
  if (mobileBar(pathname) !== "tabs") return null;
  return (
    <>
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid h-16 grid-cols-4">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? "text-brand" : "text-ink-soft"}`}>
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
