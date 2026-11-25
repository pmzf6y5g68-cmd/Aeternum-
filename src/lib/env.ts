/**
 * Accès centralisé aux variables d'environnement serveur.
 * Lecture paresseuse : le build passe sans secrets, l'erreur est explicite à l'exécution.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const env = {
  appUrl: () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeConnectWebhookSecret: () => process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "",
  resendApiKey: () => required("RESEND_API_KEY"),
  emailFrom: () => process.env.EMAIL_FROM ?? "Rendez-vous <bonjour@rendez-vous.app>",
  emailReplyTo: () => process.env.EMAIL_REPLY_TO ?? "bonjour@rendez-vous.app",
  ownerAlertEmail: () => required("OWNER_ALERT_EMAIL"),
  anthropicModel: () => process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  inboundSecret: () => required("INBOUND_EMAIL_SECRET"),
  prefillSecret: () => required("PREFILL_SECRET"),
  cronSecret: () => required("CRON_SECRET"),
  unsubscribeSecret: () => required("UNSUBSCRIBE_SECRET"),
  resendWebhookSecret: () => process.env.RESEND_WEBHOOK_SECRET ?? "",
};
