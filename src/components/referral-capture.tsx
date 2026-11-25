"use client";

import { useEffect } from "react";

/** Mémorise 30 jours le code de parrainage (?parrain=) jusqu'à la création de l'établissement. */
export function ReferralCapture({ code }: { code: string | undefined }) {
  useEffect(() => {
    if (!code || !/^[a-z0-9]{6,16}$/i.test(code)) return;
    document.cookie = `rdv_ref=${code.toLowerCase()}; max-age=${30 * 86400}; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }, [code]);
  return null;
}
