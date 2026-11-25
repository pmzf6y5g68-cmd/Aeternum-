import { getApiStudio } from "@/lib/api-auth";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Onboarding Stripe Connect Express en 1 clic : les acomptes sont des charges directes
 * sur le compte du studio, la plateforme ne détient jamais les fonds.
 */
export async function POST() {
  const studio = await getApiStudio();
  if (!studio) return jsonError("unauthorized", 401);

  try {
    const stripe = getStripe();
    let accountId = studio.stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: studio.email,
        business_type: "individual",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: studio.name, mcc: "7542", product_description: "Detailing automobile" },
        metadata: { studio_id: studio.id },
      });
      accountId = account.id;
      await createAdminClient().from("studios").update({ stripe_connect_account_id: accountId }).eq("id", studio.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${env.appUrl()}/dashboard/billing?connect=refresh`,
      return_url: `${env.appUrl()}/dashboard/billing?connect=return`,
    });
    return json({ url: link.url });
  } catch (err) {
    await logEvent("stripe.connect", errorMessage(err), { studio_id: studio.id });
    return jsonError("stripe_error", 502);
  }
}
