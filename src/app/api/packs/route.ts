import { z } from "zod";
import { formatEur, eurToCents } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { generateGiftCode } from "@/lib/gift-cards";
import { json, jsonError } from "@/lib/http";
import type { Pack } from "@/lib/packs";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

const schema = z.object({
  pack_id: z.uuid(),
  buyer_name: z.string().trim().min(2).max(80),
  buyer_email: z.email().trim().toLowerCase(),
});

/** Achat d'un carnet : prix et nombre de séances relus en base, paiement direct sur le compte Connect du pro. */
export async function POST(request: Request) {
  if (!(await rateLimit("pack", request, 10, 3600))) return jsonError("rate_limited", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const input = parsed.data;
  const admin = createAdminClient();
  const { data: pack } = await admin.from("packs").select("*").eq("id", input.pack_id).eq("active", true).maybeSingle<Pack>();
  if (!pack) return jsonError("unavailable", 404);
  const { data: biz } = await admin
    .from("businesses")
    .select("id, name, published, stripe_connect_onboarded, stripe_connect_account_id")
    .eq("id", pack.business_id)
    .single<{ id: string; name: string; published: boolean; stripe_connect_onboarded: boolean; stripe_connect_account_id: string | null }>();
  if (!biz?.published || !biz.stripe_connect_onboarded || !biz.stripe_connect_account_id) return jsonError("unavailable", 404);

  const session = await createSessionClient();
  const { data: auth } = await session.auth.getUser();
  let cp: { id: string } | null = null;
  for (let i = 0; i < 3 && !cp; i++) {
    const { data } = await admin
      .from("client_packs")
      .insert({
        pack_id: pack.id,
        business_id: pack.business_id,
        service_id: pack.service_id,
        code: generateGiftCode(),
        name: pack.name,
        buyer_name: input.buyer_name,
        buyer_email: input.buyer_email,
        user_id: auth.user?.id ?? null,
        sessions_total: pack.sessions,
        sessions_left: pack.sessions,
        price_eur: pack.price_eur,
      })
      .select("id")
      .single<{ id: string }>();
    cp = data;
  }
  if (!cp) return jsonError("server_error", 500);

  try {
    const checkout = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        customer_email: input.buyer_email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: eurToCents(pack.price_eur),
              product_data: { name: `${pack.name} — ${biz.name}`, description: `${pack.sessions} séances, valables ${Math.round(pack.validity_days / 30)} mois · ${formatEur(Math.round(eurToCents(pack.price_eur) / pack.sessions))} la séance` },
            },
          },
        ],
        metadata: { client_pack_id: cp.id, business_id: biz.id },
        payment_intent_data: { metadata: { client_pack_id: cp.id, business_id: biz.id }, description: `${pack.name} — ${biz.name}` },
        return_url: `${env.appUrl()}/carnet/paiement/${cp.id}?retour=1`,
        locale: "fr",
      },
      { stripeAccount: biz.stripe_connect_account_id },
    );
    await admin.from("client_packs").update({ stripe_checkout_session_id: checkout.id }).eq("id", cp.id);
    return json({ payment_url: `/carnet/paiement/${cp.id}` });
  } catch (err) {
    await admin.from("client_packs").update({ status: "cancelled" }).eq("id", cp.id);
    await logEvent("api.packs", errorMessage(err), { business_id: biz.id });
    return jsonError("payment_unavailable", 502);
  }
}
