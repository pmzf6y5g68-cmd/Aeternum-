"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CreditCard, Share2, Wrench } from "lucide-react";
import { fr } from "@/i18n/fr";

const items = [
  { href: "/dashboard", label: fr.dashboard.nav.agenda, icon: CalendarDays },
  { href: "/dashboard/share", label: fr.dashboard.nav.share, icon: Share2 },
  { href: "/dashboard/services", label: fr.dashboard.nav.services, icon: Wrench },
  { href: "/dashboard/billing", label: fr.dashboard.nav.billing, icon: CreditCard },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:px-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active ? "bg-accent-soft text-accent-dark" : "text-slate-600 hover:bg-white hover:text-ink"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
