"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Share2 } from "lucide-react";
import { fr } from "@/i18n/fr";

export function FavoriteButton({ businessId, initial, loggedIn, path }: { businessId: string; initial: boolean; loggedIn: boolean; path: string }) {
  const [fav, setFav] = useState(initial);
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!loggedIn) {
          router.push(`/login?next=${encodeURIComponent(path)}`);
          return;
        }
        setFav((v) => !v);
        const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: businessId }) });
        if (!res.ok) setFav((v) => !v);
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
      aria-pressed={fav}
    >
      <Heart className={`size-4 ${fav ? "fill-white" : ""}`} aria-hidden />
      <span className="hidden sm:inline">{fav ? fr.business.unfavorite : fr.business.favorite}</span>
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href.split("#")[0] ?? window.location.href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
    >
      <Share2 className="size-4" aria-hidden />
      <span className="hidden sm:inline">{copied ? "Lien copié" : fr.business.share}</span>
    </button>
  );
}
