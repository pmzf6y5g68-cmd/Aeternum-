import { siteConfig } from "@/config/site";
import { seatsFor, type BillingInterval } from "@/lib/domain/plans";
import { ensureProPrice } from "@/lib/stripe-catalog";
import { getApiBusiness } from "@/lib/pro";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Checkout d'abonnement Pro : prix par agenda (quantité = membres actifs), mensuel ou annuel, essai gratuit. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { interval?: string };
  const interval: BillingInterval = body.interval === "year" ? "year" : "month";
  const business = await getApiBusiness();
  if (!business) return jsonError("unauthorized", 401);
  if (business.plan === "pro") return jsonError("already_pro", 409);

  try {
    const stripe = getStripe();
    let customerId = business.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: business.email, name: business.name, metadata: { business_id: business.id } });
      customerId = customer.id;
      await createAdminClient().from("businesses").update({ stripe_customer_id: customerId }).eq("id", business.id);
    }

    const { count } = await createAdminClient().from("staff").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: (await ensureProPrice(interval)).id, quantity: seatsFor(count ?? 0) }],
      subscription_data: { trial_period_days: siteConfig.pricing.proTrialDays, metadata: { business_id: business.id } },
      metadata: { business_id: business.id },
      client_reference_id: business.id,
      allow_promotion_codes: true,
      // Factures conformes pour les professionnels : adresse, raison sociale et n° de TVA intracommunautaire.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      ...(process.env.STRIPE_AUTOMATIC_TAX === "true" ? { automatic_tax: { enabled: true } } : {}),
      // Carte, Apple Pay, Google Pay, Link, prélèvement SEPA… selon les moyens activés dans Stripe.
      locale: "fr",
      success_url: `${env.appUrl()}/pro/abonnement?checkout=success`,
      cancel_url: `${env.appUrl()}/pro/abonnement`,
    });
    return json({ url: session.url });
  } catch (err) {
    await logEvent("stripe.subscription", errorMessage(err), { business_id: business.id });
    return jsonError("stripe_error", 502);
  }
}
