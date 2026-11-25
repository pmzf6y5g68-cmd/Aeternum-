import { getApiStudio } from "@/lib/api-auth";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";

/** Stripe Customer Portal : moyens de paiement, factures, résiliation. */
export async function POST() {
  const studio = await getApiStudio();
  if (!studio) return jsonError("unauthorized", 401);
  if (!studio.stripe_customer_id) return jsonError("no_customer", 409);

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: studio.stripe_customer_id,
      return_url: `${env.appUrl()}/dashboard/billing`,
      locale: "fr",
    });
    return json({ url: session.url });
  } catch (err) {
    await logEvent("stripe.portal", errorMessage(err), { studio_id: studio.id });
    return jsonError("stripe_error", 502);
  }
}
