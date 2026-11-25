import "server-only";
import type Stripe from "stripe";
import { PRICE_LOOKUP_KEYS, stripeTiers, type BillingInterval } from "@/lib/domain/plans";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Catalogue Stripe auto-provisionné et idempotent (clés `lookup_key`) : produit Pro, prix mensuel et annuel
 * à paliers par agenda, portail client. Aucune configuration manuelle des prix n'est nécessaire.
 */
export async function ensureProPrice(interval: BillingInterval): Promise<Stripe.Price> {
  const stripe = getStripe();
  const lookup = PRICE_LOOKUP_KEYS[interval];
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1, expand: ["data.tiers"] });
  if (existing.data[0]) return existing.data[0];

  const products = await stripe.products.search({ query: "metadata['rdv_plan']:'pro'", limit: 1 });
  const product =
    products.data[0] ??
    (await stripe.products.create({
      name: "Rendez-vous Pro",
      description: "Rendez-vous illimités, 0 % de commission, rappels, mise en avant. Prix par agenda (membre d'équipe).",
      metadata: { rdv_plan: "pro" },
    }));
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    lookup_key: lookup,
    transfer_lookup_key: true,
    nickname: interval === "year" ? "Pro annuel (2 mois offerts)" : "Pro mensuel",
    recurring: { interval, usage_type: "licensed" },
    billing_scheme: "tiered",
    tiers_mode: "graduated",
    tiers: stripeTiers(interval),
    tax_behavior: "inclusive",
  });
}

/** Portail client : résiliation, moyens de paiement, factures, passage mensuel ↔ annuel. */
export async function ensureBillingPortal(): Promise<void> {
  const stripe = getStripe();
  const configs = await stripe.billingPortal.configurations.list({ is_default: true, active: true, limit: 1 });
  if (configs.data[0]) return;
  const [monthly, yearly] = await Promise.all([ensureProPrice("month"), ensureProPrice("year")]);
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Rendez-vous — gérez votre abonnement" },
    default_return_url: `${env.appUrl()}/pro/abonnement`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "customer_service", "too_complex", "other"] },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [{ product: typeof monthly.product === "string" ? monthly.product : monthly.product.id, prices: [monthly.id, yearly.id] }],
      },
    },
  });
}

export const RETENTION_COUPON_ID = "rdv_retention_50_3m";

/** Offre de fidélité affichée au moment de résilier : -50 % pendant 3 mois (créée une fois, réutilisée ensuite). */
export async function ensureRetentionCoupon(): Promise<string> {
  const stripe = getStripe();
  try {
    await stripe.coupons.retrieve(RETENTION_COUPON_ID);
  } catch {
    await stripe.coupons.create({ id: RETENTION_COUPON_ID, name: "Fidélité : -50 % pendant 3 mois", percent_off: 50, duration: "repeating", duration_in_months: 3 });
  }
  return RETENTION_COUPON_ID;
}

/** Nombre d'agendas facturés = membres actifs (au moins 1). Synchronisé à chaque modification d'équipe. */
export async function syncSeats(businessId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: biz }, { count }] = await Promise.all([
    admin.from("businesses").select("stripe_subscription_id").eq("id", businessId).single<{ stripe_subscription_id: string | null }>(),
    admin.from("staff").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("active", true),
  ]);
  if (!biz?.stripe_subscription_id) return;
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(biz.stripe_subscription_id);
  const item = subscription.items.data[0];
  const seats = Math.max(1, count ?? 0);
  if (item && item.quantity !== seats) {
    await stripe.subscriptions.update(subscription.id, { items: [{ id: item.id, quantity: seats }], proration_behavior: "create_prorations" });
  }
}
