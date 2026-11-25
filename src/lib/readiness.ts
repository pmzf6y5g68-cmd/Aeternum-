import "server-only";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/events";

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  detail: string;
}

const REQUIRED_SECRETS = [
  "NEXT_PUBLIC_APP_URL", "APP_DOMAIN", "OWNER_ALERT_EMAIL", "CRON_SECRET", "PREFILL_SECRET", "INBOUND_EMAIL_SECRET",
  "UNSUBSCRIBE_SECRET", "RESEND_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_WEBHOOK_SECRET", "ANTHROPIC_API_KEY",
];

async function check(name: string, fn: () => Promise<string>): Promise<ReadinessCheck> {
  try {
    return { name, ok: true, detail: await fn() };
  } catch (err) {
    return { name, ok: false, detail: errorMessage(err).slice(0, 300) };
  }
}

/**
 * « Commercialement prêt » : base à jour, paiements live opérationnels, domaine d'envoi vérifié,
 * webhooks branchés, secrets présents. La prospection en mode AUTO ne démarre que si tout est vert.
 */
export async function readiness(): Promise<{ ready: boolean; checks: ReadinessCheck[] }> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const checks = await Promise.all([
    check("secrets", async () => {
      const missing = REQUIRED_SECRETS.filter((k) => !process.env[k]);
      if (missing.length) throw new Error(`manquants : ${missing.join(", ")}`);
      if (!appUrl.startsWith("https://")) throw new Error("NEXT_PUBLIC_APP_URL doit être en https");
      return "ok";
    }),
    check("base de données", async () => {
      const { error } = await createAdminClient().from("businesses").select("calendar_token, no_show_block_threshold").limit(1);
      if (error) throw new Error(`schéma à jour requis : ${error.message}`);
      const tables = await createAdminClient().from("email_suppressions").select("email").limit(1);
      if (tables.error) throw new Error(tables.error.message);
      return "schéma à jour";
    }),
    check("stripe live", async () => {
      const key = process.env.STRIPE_SECRET_KEY ?? "";
      if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) throw new Error("clé Stripe de production requise (sk_live_)");
      if (!(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_live_")) throw new Error("clé publique pk_live_ requise");
      const stripe = getStripe();
      const account = await stripe.accounts.retrieveCurrent();
      if (!account.charges_enabled) throw new Error("compte Stripe non activé pour les paiements");
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_PRO_MONTHLY ?? "");
      if (!price.active || !price.recurring) throw new Error("prix Pro inactif ou non récurrent");
      const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
      const ours = hooks.data.filter((h) => h.url === `${appUrl}/api/webhooks/stripe` && h.status === "enabled");
      if (ours.length < 1) throw new Error(`webhook ${appUrl}/api/webhooks/stripe absent`);
      return `${ours.length} webhook(s), prix ${price.unit_amount ? price.unit_amount / 100 : "?"} €`;
    }),
    check("domaine d'envoi", async () => {
      const domain = (process.env.EMAIL_FROM ?? "").match(/@([^>\s]+)/)?.[1]?.toLowerCase();
      if (!domain) throw new Error("EMAIL_FROM invalide");
      const { data, error } = await new Resend(process.env.RESEND_API_KEY ?? "").domains.list();
      if (error) throw new Error(error.message);
      const found = data?.data.find((d) => d.name.toLowerCase() === domain);
      if (!found || found.status !== "verified") throw new Error(`domaine ${domain} non vérifié dans Resend (SPF/DKIM)`);
      return `${domain} vérifié`;
    }),
    check("application en ligne", async () => {
      const res = await fetch(`${appUrl}/manifest.webmanifest`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!res.ok) throw new Error(`${appUrl} répond ${res.status}`);
      return "accessible";
    }),
  ]);
  return { ready: checks.every((c) => c.ok), checks };
}
