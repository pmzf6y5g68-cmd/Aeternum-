import "server-only";
import type Stripe from "stripe";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/supabase/types";

export interface Pack {
  id: string;
  business_id: string;
  service_id: string;
  name: string;
  sessions: number;
  price_eur: number;
  validity_days: number;
  active: boolean;
  created_at: string;
}

export interface ClientPack {
  id: string;
  pack_id: string | null;
  business_id: string;
  service_id: string;
  code: string;
  name: string;
  buyer_name: string;
  buyer_email: string;
  user_id: string | null;
  sessions_total: number;
  sessions_left: number;
  price_eur: number;
  status: "pending" | "active" | "cancelled";
  stripe_checkout_session_id: string | null;
  expires_at: string | null;
  created_at: string;
}

/** Messages clairs pour chaque refus de la RPC consume_pack_session. */
export const PACK_ERRORS: Record<string, { code: string; status: number }> = {
  PACK_INVALID: { code: "pack_invalid", status: 422 },
  PACK_WRONG_SERVICE: { code: "pack_wrong_service", status: 422 },
  PACK_EXPIRED: { code: "pack_expired", status: 422 },
  PACK_EMPTY: { code: "pack_empty", status: 422 },
};

/** Prix d'une séance dans le carnet, pour afficher l'économie (« soit 18 € la séance au lieu de 22 € »). */
export function perSessionCents(pack: Pick<Pack, "price_eur" | "sessions">): number {
  return Math.round(eurToCents(pack.price_eur) / Math.max(1, pack.sessions));
}

const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Paiement reçu : le carnet devient actif, l'acheteur reçoit son code, le pro est prévenu. Idempotent. */
export async function activateClientPack(session: Stripe.Checkout.Session, connectedAccount: string | undefined): Promise<void> {
  const id = session.metadata?.client_pack_id;
  if (!id || session.payment_status !== "paid") return;
  const admin = createAdminClient();
  const { data: pending } = await admin.from("client_packs").select("*").eq("id", id).maybeSingle<ClientPack>();
  if (!pending || pending.status !== "pending") return;
  const { data: pack } = pending.pack_id ? await admin.from("packs").select("validity_days").eq("id", pending.pack_id).maybeSingle<{ validity_days: number }>() : { data: null };
  const expires = new Date(Date.now() + (pack?.validity_days ?? 365) * 86_400_000).toISOString();
  const { data: updated } = await admin.from("client_packs").update({ status: "active", expires_at: expires }).eq("id", id).eq("status", "pending").select("*").returns<ClientPack[]>();
  const cp = updated?.[0];
  if (!cp) return;
  const { data: b } = await admin.from("businesses").select("*").eq("id", cp.business_id).single<Business>();
  if (!b || (connectedAccount && b.stripe_connect_account_id !== connectedAccount)) {
    await logEvent("pack.activate", "account mismatch", { client_pack_id: id, connectedAccount });
    return;
  }
  const page = `${env.appUrl()}${businessPath(b)}#reserver`;
  const lines = [
    `Merci ${cp.buyer_name} ! Votre ${cp.name} chez ${b.name} est actif : ${cp.sessions_total} séances, valables jusqu'au ${dateFr(expires)}.`,
    `Votre code : ${cp.code}`,
    "À chaque réservation, cochez « J'ai un carnet » et saisissez ce code : la séance est déduite automatiquement. Une annulation dans les délais vous rend la séance.",
  ];
  await sendEmail({
    to: cp.buyer_email,
    replyTo: b.email,
    subject: `Votre carnet de ${cp.sessions_total} séances chez ${b.name}`,
    text: `${lines.join("\n\n")}\n\nRéserver : ${page}`,
    html: layoutHtml("Votre carnet est actif", lines, [{ label: "Réserver ma première séance", url: page }]),
  });
  await sendEmail({
    to: b.email,
    subject: `Carnet vendu : ${formatEur(eurToCents(cp.price_eur))}`,
    text: `${cp.buyer_name} a acheté « ${cp.name} » (${cp.sessions_total} séances) pour ${formatEur(eurToCents(cp.price_eur))}. L'argent est sur votre compte Stripe. Les séances se déduisent automatiquement à chaque réservation.`,
  });
}
