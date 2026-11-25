import { siteConfig } from "@/config/site";
import { getApiBusiness } from "@/lib/pro";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Checkout d'abonnement Pro (49 €/mois, 14 jours d'essai). */
export async function POST() {
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: env.stripePriceProMonthly(), quantity: 1 }],
      subscription_data: { trial_period_days: siteConfig.pricing.proTrialDays, metadata: { business_id: business.id } },
      metadata: { business_id: business.id },
      client_reference_id: business.id,
      allow_promotion_codes: false,
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
