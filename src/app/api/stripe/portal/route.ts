import type Stripe from "stripe";
import { getApiBusiness } from "@/lib/pro";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { ensureBillingPortal, ensureProPrice, ensureRetentionCoupon } from "@/lib/stripe-catalog";

/**
 * Stripe Customer Portal : moyens de paiement, factures, résiliation.
 * `flow` : "annual" (passage à l'annuel en 1 clic, 2 mois offerts) ou "cancel" (résiliation avec offre de fidélité).
 */
export async function POST(request: Request) {
  const business = await getApiBusiness();
  if (!business) return jsonError("unauthorized", 401);
  if (!business.stripe_customer_id) return jsonError("no_customer", 409);
  const body = (await request.json().catch(() => ({}))) as { flow?: string };
  const returnUrl = `${env.appUrl()}/pro/abonnement`;

  try {
    const configuration = await ensureBillingPortal();
    const stripe = getStripe();
    let flow: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;
    if (business.stripe_subscription_id && (body.flow === "annual" || body.flow === "cancel")) {
      const subscription = await stripe.subscriptions.retrieve(business.stripe_subscription_id);
      const item = subscription.items.data[0];
      if (body.flow === "annual" && item && item.price.recurring?.interval === "month") {
        const yearly = await ensureProPrice("year");
        flow = {
          type: "subscription_update_confirm",
          subscription_update_confirm: { subscription: subscription.id, items: [{ id: item.id, price: yearly.id, quantity: item.quantity ?? 1 }] },
          after_completion: { type: "redirect", redirect: { return_url: `${returnUrl}?annuel=1` } },
        };
      } else if (body.flow === "cancel" && !subscription.cancel_at_period_end) {
        // Offre de fidélité proposée une seule fois par client (le coupon n'est plus proposé s'il a déjà servi).
        const coupon = await ensureRetentionCoupon();
        const alreadyOffered = (subscription.discounts ?? []).length > 0;
        flow = {
          type: "subscription_cancel",
          subscription_cancel: { subscription: subscription.id, ...(alreadyOffered ? {} : { retention: { type: "coupon_offer", coupon_offer: { coupon } } }) },
        };
      }
    }
    const session = await stripe.billingPortal.sessions.create({ customer: business.stripe_customer_id, configuration, return_url: returnUrl, locale: "fr", ...(flow ? { flow_data: flow } : {}) });
    return json({ url: session.url });
  } catch (err) {
    await logEvent("stripe.portal", errorMessage(err), { business_id: business.id, flow: body.flow });
    return jsonError("stripe_error", 502);
  }
}
