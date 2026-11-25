"use client";

import { useEffect } from "react";

/** Mémorise pour la session qu'un client est arrivé par le lien du professionnel (?via=pro) : pas de commission. */
export function Attribution({ slug, via }: { slug: string; via: string | undefined }) {
  useEffect(() => {
    if (via !== "pro") return;
    try {
      sessionStorage.setItem(`rdv_src_${slug}`, "direct");
    } catch {
      // Stockage indisponible : la réservation sera simplement attribuée à la marketplace.
    }
  }, [slug, via]);
  return null;
}
