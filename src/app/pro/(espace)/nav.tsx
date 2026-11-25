"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, CreditCard, Gift, LayoutList, Share2, ShieldCheck, Star, Store, TrendingUp, Users } from "lucide-react";
import { fr } from "@/i18n/fr";

const n = fr.dashboard.nav;
const items = [
  { href: "/pro/agenda", label: n.agenda, icon: CalendarDays },
  { href: "/pro/prestations", label: n.services, icon: LayoutList },
  { href: "/pro/equipe", label: n.team, icon: Users },
  { href: "/pro/horaires", label: n.hours, icon: Clock },
  { href: "/pro/ma-page", label: n.page, icon: Store },
  { href: "/pro/visibilite", label: "Visibilité", icon: TrendingUp },
  { href: "/pro/partager", label: n.share, icon: Share2 },
  { href: "/pro/avis", label: n.reviews, icon: Star },
  { href: "/pro/cartes-cadeaux", label: "Cartes cadeaux", icon: Gift },
  { href: "/pro/abonnement", label: n.billing, icon: CreditCard },
  { href: "/compte/securite", label: "Sécurité", icon: ShieldCheck },
];

export function ProNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:px-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-brand text-white" : "text-ink-soft hover:bg-white hover:text-ink"}`}>
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
