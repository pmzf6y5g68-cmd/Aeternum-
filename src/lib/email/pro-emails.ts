import "server-only";
import { siteConfig } from "@/config/site";
import { formatEur } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/supabase/types";
import { layoutHtml, sendEmail } from "./send";

type Pro = Pick<Business, "id" | "name" | "email">;

function send(to: string, subject: string, title: string, paragraphs: string[], cta: { label: string; url: string }[]) {
  return sendEmail({
    to,
    subject,
    text: [...paragraphs, ...cta.map((c) => `${c.label} : ${c.url}`)].join("\n\n"),
    html: layoutHtml(title, paragraphs, cta),
  });
}

/** Paiement d'abonnement refusé : Stripe relance automatiquement, on prévient le pro avec le lien de mise à jour. */
export async function notifyPaymentFailed(customerId: string, attempt: number, nextAttemptUnix: number | null): Promise<void> {
  const { data: b } = await createAdminClient().from("businesses").select("id, name, email").eq("stripe_customer_id", customerId).maybeSingle<Pro>();
  if (!b) return;
  const next = nextAttemptUnix ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(nextAttemptUnix * 1000)) : null;
  await send(
    b.email,
    "Votre paiement n'est pas passé",
    "Mettez à jour votre moyen de paiement",
    [
      `Le prélèvement de votre abonnement ${siteConfig.name} Pro pour ${b.name} a été refusé${attempt > 1 ? ` (tentative ${attempt})` : ""}.`,
      next ? `Une nouvelle tentative aura lieu le ${next}. Pour éviter toute interruption, vérifiez votre carte en une minute.` : "Pour éviter l'interruption de vos fonctions Pro, vérifiez votre moyen de paiement.",
      "Votre agenda et vos réservations restent accessibles en attendant.",
    ],
    [{ label: "Mettre à jour ma carte", url: `${env.appUrl()}/pro/abonnement` }],
  );
}

export async function sendQuotaNudge(b: Pro, used: number, limit: number): Promise<void> {
  await send(
    b.email,
    `${used} réservations sur ${limit} ce mois-ci`,
    "Vous approchez de la limite du plan Gratuit",
    [
      `Bravo : ${b.name} a déjà reçu ${used} réservations ce mois-ci. Le plan Gratuit en inclut ${limit} par mois.`,
      `Au-delà, vos clients ne pourront plus réserver en ligne jusqu'au mois prochain. Avec Pro, les réservations sont illimitées, avec rappels, relances de fidélisation et mise en avant dans la recherche.`,
      `Essai gratuit de ${siteConfig.pricing.proTrialDays} jours, sans engagement, à partir de ${siteConfig.pricing.proMonthlyPriceEur} € par mois.`,
    ],
    [{ label: "Passer en Pro", url: `${env.appUrl()}/pro/abonnement` }],
  );
}

export async function sendQuotaBlocked(b: Pro, limit: number): Promise<void> {
  await send(
    b.email,
    "Un client n'a pas pu réserver chez vous",
    "Un client vient d'essayer de réserver",
    [
      `Un client a voulu prendre rendez-vous avec ${b.name}, mais vos ${limit} réservations gratuites du mois sont atteintes : il n'a pas pu réserver.`,
      `Passez en Pro pour ne plus perdre de clients : réservations illimitées dès maintenant, essai gratuit de ${siteConfig.pricing.proTrialDays} jours.`,
    ],
    [{ label: "Débloquer mes réservations", url: `${env.appUrl()}/pro/abonnement` }],
  );
}

export interface MonthlyReport {
  monthLabel: string;
  views: number;
  bookings: number;
  marketplaceBookings: number;
  revenueEur: number;
  newReviews: number;
  score: number;
}

export async function sendMonthlyReport(b: Pro & Pick<Business, "plan">, r: MonthlyReport): Promise<void> {
  const lines = [
    `Voici le bilan de ${b.name} pour ${r.monthLabel} :`,
    `${r.views} vues de votre page · ${r.bookings} rendez-vous réservés (dont ${r.marketplaceBookings} nouveaux clients venus de ${siteConfig.name}) · ${formatEur(Math.round(r.revenueEur * 100))} de chiffre d'affaires réservé · ${r.newReviews} nouvel${r.newReviews > 1 ? "s" : ""} avis.`,
    `Score de visibilité : ${r.score}/100.${r.score < 80 ? " Quelques minutes suffisent pour gagner des places : suivez les actions indiquées dans votre espace." : " Excellent, continuez ainsi."}`,
  ];
  if (b.plan !== "pro") lines.push(`Avec Pro : réservations illimitées, rappels, relances automatiques de vos anciens clients et mise en avant dans la recherche.`);
  await send(
    b.email,
    `Votre bilan ${r.monthLabel} : ${r.bookings} rendez-vous`,
    `Votre mois sur ${siteConfig.name}`,
    lines,
    [{ label: "Voir mes statistiques", url: `${env.appUrl()}/pro/visibilite` }, ...(b.plan !== "pro" ? [{ label: "Découvrir Pro", url: `${env.appUrl()}/pro/abonnement` }] : [])],
  );
}

/** Quota gratuit atteint au moment où un client réserve : alerte au plus une fois par semaine. */
export async function alertQuotaBlocked(businessId: string, limit: number): Promise<void> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await createAdminClient()
    .from("businesses")
    .update({ quota_block_alert_at: new Date().toISOString() })
    .eq("id", businessId)
    .or(`quota_block_alert_at.is.null,quota_block_alert_at.lt.${weekAgo}`)
    .select("id, name, email")
    .returns<Pro[]>();
  const b = data?.[0];
  if (b) await sendQuotaBlocked(b, limit);
}
