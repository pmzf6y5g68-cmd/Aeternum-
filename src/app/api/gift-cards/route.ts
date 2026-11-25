import { z } from "zod";
import { formatEur } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { GIFT_MAX_EUR, GIFT_MIN_EUR, generateGiftCode } from "@/lib/gift-cards";
import { json, jsonError } from "@/lib/http";
import { loadPublicBusiness } from "@/lib/marketplace";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  business: z.string().min(3).max(60),
  amount_eur: z.coerce.number().int().min(GIFT_MIN_EUR).max(GIFT_MAX_EUR),
  buyer_name: z.string().trim().min(2).max(80),
  buyer_email: z.email().trim().toLowerCase(),
  recipient_name: z.string().trim().min(2).max(80),
  recipient_email: z.union([z.email().trim().toLowerCase(), z.literal("")]).optional().default(""),
  message: z.string().trim().max(500).optional().default(""),
});

/** Achat d'une carte cadeau : paiement direct sur le compte Connect du pro (aucune commission). */
export async function POST(request: Request) {
  if (!(await rateLimit("giftcard", request, 10, 3600))) return jsonError("rate_limited", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const input = parsed.data;
  const business = await loadPublicBusiness(input.business);
  if (!business || !business.gift_cards_enabled || !business.stripe_connect_onboarded) return jsonError("unavailable", 404);

  const admin = createAdminClient();
  const { data: acct } = await admin.from("businesses").select("stripe_connect_account_id").eq("id", business.id).single<{ stripe_connect_account_id: string | null }>();
  if (!acct?.stripe_connect_account_id) return jsonError("unavailable", 404);

  let card: { id: string; code: string } | null = null;
  for (let i = 0; i < 3 && !card; i++) {
    const { data } = await admin
      .from("gift_cards")
      .insert({
        business_id: business.id,
        code: generateGiftCode(),
        amount_eur: input.amount_eur,
        buyer_name: input.buyer_name,
        buyer_email: input.buyer_email,
        recipient_name: input.recipient_name,
        recipient_email: input.recipient_email || null,
        message: input.message || null,
      })
      .select("id, code")
      .single<{ id: string; code: string }>();
    card = data;
  }
  if (!card) return jsonError("server_error", 500);

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        customer_email: input.buyer_email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: input.amount_eur * 100,
              product_data: { name: `Carte cadeau ${business.name}`, description: `${formatEur(input.amount_eur * 100)} pour ${input.recipient_name}, valable 1 an` },
            },
          },
        ],
        metadata: { gift_card_id: card.id, business_id: business.id },
        payment_intent_data: { metadata: { gift_card_id: card.id, business_id: business.id }, description: `Carte cadeau ${business.name}` },
        return_url: `${env.appUrl()}/carte-cadeau/paiement/${card.id}?retour=1`,
        locale: "fr",
      },
      { stripeAccount: acct.stripe_connect_account_id },
    );
    await admin.from("gift_cards").update({ stripe_checkout_session_id: session.id }).eq("id", card.id);
    return json({ payment_url: `/carte-cadeau/paiement/${card.id}` });
  } catch (err) {
    await admin.from("gift_cards").update({ status: "cancelled" }).eq("id", card.id);
    await logEvent("api.giftCards", errorMessage(err), { business_id: business.id });
    return jsonError("payment_unavailable", 502);
  }
}
