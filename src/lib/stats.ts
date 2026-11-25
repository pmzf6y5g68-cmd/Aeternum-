import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse|headless|curl|wget|python|monitor/i;

/** Compte une vue de fiche (agrégat journalier, sans cookie ni donnée personnelle). Ne bloque jamais la page. */
export async function trackBusinessView(businessId: string, widget = false): Promise<void> {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    if (!ua || BOT.test(ua) || h.get("purpose") === "prefetch" || h.get("next-router-prefetch")) return;
    await createAdminClient().rpc("track_business_view", { p_business_id: businessId, p_widget: widget });
  } catch {
    // Statistique non critique.
  }
}
