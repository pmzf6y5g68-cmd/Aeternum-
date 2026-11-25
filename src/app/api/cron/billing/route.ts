import { isAuthorizedCron, isParisHour } from "@/lib/cron";
import { zonedParts } from "@/lib/domain/time";
import { siteConfig } from "@/config/site";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { currentMonthRange } from "@/lib/pro";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Business } from "@/lib/supabase/types";

/**
 * Le 1er du mois à 6h (Paris) : facture Stripe des commissions « nouveau client marketplace » du mois écoulé,
 * uniquement pour les rendez-vous honorés (statut « Terminé »). Envoyée par Stripe, payable par carte, prélèvement…
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && (!isParisHour(request, 6) || zonedParts(new Date(), siteConfig.booking.timeZone).day !== 1)) return json({ skipped: "not_billing_time" });

  const admin = createAdminClient();
  const { start } = currentMonthRange();
  const { data: rows } = await admin
    .from("bookings")
    .select("id, business_id, service_name, client_name, start_at, commission_eur")
    .eq("status", "completed")
    .eq("commission_invoiced", false)
    .gt("commission_eur", 0)
    .lt("end_at", start.toISOString())
    .limit(10000)
    .returns<Pick<Booking, "id" | "business_id" | "service_name" | "client_name" | "start_at" | "commission_eur">[]>();

  const byBusiness = new Map<string, typeof rows>();
  for (const r of rows ?? []) byBusiness.set(r.business_id, [...(byBusiness.get(r.business_id) ?? []), r]);

  const stripe = getStripe();
  let invoices = 0;
  for (const [businessId, items] of byBusiness) {
    if (!items?.length) continue;
    const { data: biz } = await admin.from("businesses").select("id, name, email, stripe_customer_id").eq("id", businessId).single<Pick<Business, "id" | "name" | "email" | "stripe_customer_id">>();
    if (!biz) continue;
    try {
      let customer = biz.stripe_customer_id;
      if (!customer) {
        customer = (await stripe.customers.create({ email: biz.email, name: biz.name, metadata: { business_id: biz.id } })).id;
        await admin.from("businesses").update({ stripe_customer_id: customer }).eq("id", biz.id);
      }
      const invoice = await stripe.invoices.create({
        customer,
        collection_method: "send_invoice",
        days_until_due: 14,
        auto_advance: true,
        description: "Commissions Rendez-vous : premier rendez-vous de nouveaux clients venus de la plateforme (plan Gratuit).",
        metadata: { business_id: biz.id },
      });
      for (const it of items) {
        await stripe.invoiceItems.create({
          customer,
          invoice: invoice.id,
          currency: "eur",
          amount: Math.round(Number(it.commission_eur) * 100),
          description: `${it.service_name} — ${it.client_name} — ${new Date(it.start_at).toLocaleDateString("fr-FR")}`,
          metadata: { booking_id: it.id },
        });
      }
      if (invoice.id) await stripe.invoices.finalizeInvoice(invoice.id);
      await admin.from("bookings").update({ commission_invoiced: true }).in("id", items.map((i) => i.id));
      invoices++;
    } catch (err) {
      await logEvent("cron.billing", errorMessage(err), { business_id: businessId });
    }
  }
  return json({ invoices, bookings: rows?.length ?? 0 });
}
