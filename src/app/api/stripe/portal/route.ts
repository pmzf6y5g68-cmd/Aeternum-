import { getApiBusiness } from "@/lib/pro";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";

/** Stripe Customer Portal : moyens de paiement, factures, résiliation. */
export async function POST() {
  const business = await getApiBusiness();
  if (!business) return jsonError("unauthorized", 401);
  if (!business.stripe_customer_id) return jsonError("no_customer", 409);

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${env.appUrl()}/pro/abonnement`,
      locale: "fr",
    });
    return json({ url: session.url });
  } catch (err) {
    await logEvent("stripe.portal", errorMessage(err), { business_id: business.id });
    return jsonError("stripe_error", 502);
  }
}
