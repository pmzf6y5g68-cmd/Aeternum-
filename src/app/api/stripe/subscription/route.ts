import { siteConfig } from "@/config/site";
import { getApiStudio } from "@/lib/api-auth";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Checkout d'abonnement Pro (49 €/mois, 14 jours d'essai). */
export async function POST() {
  const studio = await getApiStudio();
  if (!studio) return jsonError("unauthorized", 401);
  if (studio.plan === "pro") return jsonError("already_pro", 409);

  try {
    const stripe = getStripe();
    let customerId = studio.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: studio.email, name: studio.name, metadata: { studio_id: studio.id } });
      customerId = customer.id;
      await createAdminClient().from("studios").update({ stripe_customer_id: customerId }).eq("id", studio.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: env.stripePriceProMonthly(), quantity: 1 }],
      subscription_data: { trial_period_days: siteConfig.pricing.proTrialDays, metadata: { studio_id: studio.id } },
      metadata: { studio_id: studio.id },
      client_reference_id: studio.id,
      allow_promotion_codes: false,
      locale: "fr",
      success_url: `${env.appUrl()}/dashboard/billing?checkout=success`,
      cancel_url: `${env.appUrl()}/dashboard/billing`,
    });
    return json({ url: session.url });
  } catch (err) {
    await logEvent("stripe.subscription", errorMessage(err), { studio_id: studio.id });
    return jsonError("stripe_error", 502);
  }
}
