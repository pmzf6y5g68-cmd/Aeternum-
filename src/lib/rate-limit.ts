import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Empreinte non réversible de l'adresse IP du client (aucune IP stockée en clair). */
export function clientFingerprint(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.CRON_SECRET ?? ""}:${ip}`).digest("base64url").slice(0, 22);
}

/**
 * Fenêtre fixe partagée par toutes les instances (Postgres). Renvoie false si la limite est dépassée.
 * En cas d'indisponibilité de la base, on laisse passer : la réservation reste protégée par ses propres verrous.
 */
export async function rateLimit(scope: string, request: Request, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", { p_key: `${scope}:${clientFingerprint(request)}`, p_window_seconds: windowSeconds, p_max: max });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
