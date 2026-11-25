"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";

const tabs = [
  { href: "/compte", label: fr.account.title },
  { href: "/compte/favoris", label: fr.account.favorites },
  { href: "/compte/profil", label: fr.account.profile },
  { href: "/compte/securite", label: "Sécurité" },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
