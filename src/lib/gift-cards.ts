import "server-only";
import { randomInt } from "node:crypto";
import type Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/supabase/types";
import { formatGiftCode } from "@/lib/domain/gift-code";

export interface GiftCard {
  id: string;
  business_id: string;
  code: string;
  amount_eur: number;
  buyer_name: string;
  buyer_email: string;
  recipient_name: string;
  recipient_email: string | null;
  message: string | null;
  status: "pending" | "active" | "redeemed" | "cancelled";
  stripe_checkout_session_id: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  created_at: string;
}

/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateGiftCode(): string {
  return formatGiftCode(Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""));
}

const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Paiement reçu : la carte devient valable 1 an, envoyée au bénéficiaire (ou à l'acheteur), le pro est prévenu. */
export async function activateGiftCard(session: Stripe.Checkout.Session, connectedAccount: string | undefined): Promise<void> {
  const id = session.metadata?.gift_card_id;
  if (!id || session.payment_status !== "paid") return;
  const admin = createAdminClient();
  const expires = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const { data: updated } = await admin
    .from("gift_cards")
    .update({ status: "active", expires_at: expires })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .returns<GiftCard[]>();
  const card = updated?.[0];
  if (!card) return; // Déjà activée (idempotence).
  const { data: b } = await admin.from("businesses").select("*").eq("id", card.business_id).single<Business>();
  if (!b || (connectedAccount && b.stripe_connect_account_id !== connectedAccount)) {
    await logEvent("giftcard.activate", "account mismatch", { gift_card_id: id, connectedAccount });
    return;
  }
  const amount = formatEur(eurToCents(card.amount_eur));
  const page = `${env.appUrl()}${businessPath(b)}`;
  const lines = [
    `${card.buyer_name} vous offre une carte cadeau de ${amount} chez ${b.name}${b.city ? ` (${b.city})` : ""}.`,
    ...(card.message ? [`« ${card.message} »`] : []),
    `Votre code : ${card.code}`,
    `Réservez quand vous voulez et présentez ce code sur place. Valable jusqu'au ${dateFr(expires)}.`,
  ];
  await sendEmail({
    to: card.recipient_email || card.buyer_email,
    subject: `${card.buyer_name} vous offre ${amount} chez ${b.name}`,
    text: `${lines.join("\n\n")}\n\nRéserver : ${page}`,
    html: layoutHtml(`Une carte cadeau pour vous, ${card.recipient_name}`, lines, [{ label: `Réserver chez ${b.name}`, url: page }]),
    replyTo: b.email,
  });
  if (card.recipient_email) {
    await sendEmail({
      to: card.buyer_email,
      subject: `Votre carte cadeau pour ${card.recipient_name} est partie`,
      text: `Merci ${card.buyer_name}. ${card.recipient_name} a reçu la carte cadeau de ${amount} chez ${b.name} (code ${card.code}), valable jusqu'au ${dateFr(expires)}.`,
      html: layoutHtml("Votre carte cadeau est partie", [`Merci ${card.buyer_name}.`, `${card.recipient_name} a reçu la carte cadeau de ${amount} chez ${b.name}, valable jusqu'au ${dateFr(expires)}.`, `Code : ${card.code}`]),
    });
  }
  await sendEmail({
    to: b.email,
    subject: `Carte cadeau vendue : ${amount}`,
    text: `${card.buyer_name} a acheté une carte cadeau de ${amount} pour ${card.recipient_name}. L'argent est sur votre compte Stripe. Code à valider le jour du rendez-vous : ${card.code} (espace pro › Cartes cadeaux).`,
    html: layoutHtml(`Carte cadeau vendue : ${amount}`, [
      `${card.buyer_name} a acheté une carte cadeau de ${amount} pour ${card.recipient_name}.`,
      "L'argent est déjà sur votre compte Stripe.",
      `Le jour du rendez-vous, validez le code ${card.code} dans votre espace.`,
    ], [{ label: "Mes cartes cadeaux", url: `${env.appUrl()}/pro/cartes-cadeaux` }]),
  });
}

export const GIFT_AMOUNTS = [30, 50, 80, 100, 150] as const;
export const GIFT_MIN_EUR = 10;
export const GIFT_MAX_EUR = 1000;
export const giftSiteName = siteConfig.name;
