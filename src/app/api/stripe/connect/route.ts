import { getApiBusiness } from "@/lib/pro";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Onboarding Stripe Connect Express en 1 clic : les acomptes sont des charges directes
 * sur le compte de l'établissement, la plateforme ne détient jamais les fonds.
 */
export async function POST() {
  const business = await getApiBusiness();
  if (!business) return jsonError("unauthorized", 401);

  try {
    const stripe = getStripe();
    let accountId = business.stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: business.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: business.name, product_description: "Prestations sur rendez-vous" },
        metadata: { business_id: business.id },
      });
      accountId = account.id;
      await createAdminClient().from("businesses").update({ stripe_connect_account_id: accountId }).eq("id", business.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${env.appUrl()}/pro/abonnement?connect=refresh`,
      return_url: `${env.appUrl()}/pro/abonnement?connect=return`,
    });
    return json({ url: link.url });
  } catch (err) {
    await logEvent("stripe.connect", errorMessage(err), { business_id: business.id });
    return jsonError("stripe_error", 502);
  }
}
