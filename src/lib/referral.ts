import "server-only";
import { siteConfig } from "@/config/site";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/supabase/types";

/** Récompense : un mois d'agenda Pro offert (crédit Stripe imputé sur les prochaines factures). */
export const REFERRAL_CREDIT_CENTS = siteConfig.pricing.proMonthlyPriceEur * 100;

export function referralUrl(code: string): string {
  return `${env.appUrl()}/pro?parrain=${code}`;
}

async function ensureCustomer(b: Pick<Business, "id" | "email" | "name" | "stripe_customer_id">): Promise<string> {
  if (b.stripe_customer_id) return b.stripe_customer_id;
  const customer = await getStripe().customers.create({ email: b.email, name: b.name, metadata: { business_id: b.id } });
  await createAdminClient().from("businesses").update({ stripe_customer_id: customer.id }).eq("id", b.id);
  return customer.id;
}

async function credit(b: Pick<Business, "id" | "email" | "name" | "stripe_customer_id">, description: string, key: string): Promise<void> {
  const customerId = await ensureCustomer(b);
  await getStripe().customers.createBalanceTransaction(customerId, { amount: -REFERRAL_CREDIT_CENTS, currency: "eur", description }, { idempotencyKey: key });
}

/**
 * Premier paiement d'un filleul : crédite parrain et filleul d'un mois, une seule fois
 * (réservation atomique de `referral_rewarded_at`, clés d'idempotence Stripe).
 */
export async function rewardReferralOnFirstPayment(customerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("businesses")
    .update({ referral_rewarded_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId)
    .not("referred_by", "is", null)
    .is("referral_rewarded_at", null)
    .select("id, name, email, stripe_customer_id, referred_by")
    .returns<(Pick<Business, "id" | "name" | "email" | "stripe_customer_id"> & { referred_by: string })[]>();
  const referee = claimed?.[0];
  if (!referee) return;

  const { data: referrer } = await admin.from("businesses").select("id, name, email, stripe_customer_id").eq("id", referee.referred_by).maybeSingle<Pick<Business, "id" | "name" | "email" | "stripe_customer_id">>();
  try {
    await credit(referee, `Parrainage : 1 mois offert (parrain ${referrer?.name ?? ""})`.trim(), `ref-referee-${referee.id}`);
    if (referrer) {
      await credit(referrer, `Parrainage : 1 mois offert (filleul ${referee.name})`, `ref-referrer-${referee.id}`);
      await sendEmail({
        to: referrer.email,
        subject: `${referee.name} vous offre un mois sur ${siteConfig.name}`,
        text: `Bonne nouvelle : ${referee.name}, que vous avez recommandé, vient de passer en Pro. Un mois d'abonnement vous est offert : il sera déduit automatiquement de vos prochaines factures. Recommandez d'autres pros : ${env.appUrl()}/pro/partager#parrainage`,
        html: layoutHtml(`Un mois offert grâce à ${referee.name}`, [
          `${referee.name}, que vous avez recommandé, vient de passer en Pro.`,
          `Un mois d'abonnement vous est offert : il sera déduit automatiquement de vos prochaines factures. Il n'y a rien à faire.`,
          `Chaque professionnel que vous recommandez vous rapporte un nouveau mois offert.`,
        ], [{ label: "Recommander d'autres pros", url: `${env.appUrl()}/pro/partager#parrainage` }]),
      });
    }
  } catch (err) {
    await logEvent("referral.reward", errorMessage(err), { referee: referee.id });
  }
}
