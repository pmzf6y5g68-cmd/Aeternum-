import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { siteConfig } from "@/config/site";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { signPrefill } from "@/lib/prefill";
import { getCategory } from "@/config/categories";
import { countMonthlyBookings, publicBusinessUrl } from "@/lib/pro";
import { suppressEmail } from "@/lib/suppression";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business, EmailMessage, EmailThread, Prospect } from "@/lib/supabase/types";
import { decideReply, finalizeDecision, replySubject, type AgentContext, type AgentDecision, type ContactContext } from "./email-agent";
import { evaluateGuardrails, normalizeEmail, type InboundEmail } from "./email-guardrails";

export type PipelineResult =
  | { status: "duplicate" }
  | { status: "dropped"; reason: string }
  | { status: "opted_out" }
  | { status: "ooo_paused" }
  | { status: "escalated"; reason: string }
  | { status: "replied"; messageId: string }
  | { status: "no_reply" };

const SIGNATURE = "Bien à vous,\nL'équipe Rendez-vous";
const MAX_REFERENCES = 20;

function extractIds(value: string | null): string[] {
  return value?.match(/<[^>]+>/g) ?? [];
}

function appendReference(chain: string | null, id: string | null): string {
  const ids = [...extractIds(chain), ...(id ? [id] : [])];
  return Array.from(new Set(ids)).slice(-MAX_REFERENCES).join(" ");
}

async function findThread(email: InboundEmail): Promise<EmailThread | null> {
  const admin = createAdminClient();
  const ids = [...extractIds(email.inReplyTo), ...extractIds(email.references)];
  if (ids.length) {
    const { data } = await admin.from("email_messages").select("thread_id").in("message_id", ids).limit(1).returns<Pick<EmailMessage, "thread_id">[]>();
    const threadId = data?.[0]?.thread_id;
    if (threadId) {
      const { data: thread } = await admin.from("email_threads").select("*").eq("id", threadId).maybeSingle<EmailThread>();
      if (thread) return thread;
    }
  }
  // Repli : dernier fil avec ce contact (certains clients mail perdent les en-têtes de threading).
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await admin
    .from("email_threads")
    .select("*")
    .eq("contact_email", normalizeEmail(email.from))
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<EmailThread[]>();
  return data?.[0] ?? null;
}

async function loadContact(contactEmail: string, thread: EmailThread | null): Promise<{ prospect: Prospect | null; business: Business | null }> {
  const admin = createAdminClient();
  const [prospect, business] = await Promise.all([
    thread?.prospect_id
      ? admin.from("prospects").select("*").eq("id", thread.prospect_id).maybeSingle<Prospect>()
      : admin.from("prospects").select("*").eq("email", contactEmail).maybeSingle<Prospect>(),
    thread?.business_id
      ? admin.from("businesses").select("*").eq("id", thread.business_id).maybeSingle<Business>()
      : admin.from("businesses").select("*").eq("email", contactEmail).limit(1).maybeSingle<Business>(),
  ]);
  return { prospect: prospect.data, business: business.data };
}

async function buildContactContext(prospect: Prospect | null, business: Business | null): Promise<ContactContext> {
  if (business) {
    return {
      kind: "business",
      name: business.name,
      category: getCategory(business.category)?.label ?? business.category,
      city: business.city,
      plan: business.plan,
      monthlyBookings: await countMonthlyBookings(createAdminClient(), business.id),
      freeMonthlyLimit: siteConfig.pricing.freeMonthlyBookings,
      connectOnboarded: business.stripe_connect_onboarded,
      depositEnabled: business.deposit_enabled,
      publicUrl: publicBusinessUrl(business),
    };
  }
  if (prospect) {
    return { kind: "prospect", name: prospect.name, category: getCategory(prospect.category)?.label ?? null, city: prospect.city, status: prospect.status, website: prospect.website };
  }
  return { kind: "unknown" };
}

async function alertOwner(params: {
  reason: string;
  email: InboundEmail;
  thread: EmailThread;
  contact: ContactContext;
  history: { direction: string; body: string; created_at: string }[];
  draft: string;
}): Promise<void> {
  const transcript = params.history.map((m) => `--- ${m.direction === "outbound" ? "Rendez-vous" : "Contact"} · ${m.created_at}\n${m.body}`).join("\n\n");
  const lines = [
    `Raison : ${params.reason}`,
    `Contact : ${params.email.from} (${params.contact.kind})`,
    `Objet : ${params.email.subject}`,
    `Fil : ${params.thread.id} · réponses IA : ${params.thread.ai_reply_count}`,
    "",
    "=== Brouillon suggéré (NON envoyé) ===",
    params.draft || "(aucun brouillon)",
    "",
    "=== Fil complet ===",
    transcript,
    "",
    "Répondez directement au contact depuis votre messagerie : aucune réponse automatique ne sera plus envoyée sur ce fil.",
  ];
  await sendEmail({
    to: env.ownerAlertEmail(),
    replyTo: normalizeEmail(params.email.from),
    subject: `[Rendez-vous · escalade] ${params.reason} — ${normalizeEmail(params.email.from)}`,
    text: lines.join("\n"),
    html: layoutHtml(`Escalade : ${params.reason}`, lines.filter(Boolean)),
  });
}

export interface PipelineDeps {
  anthropic?: Pick<Anthropic, "messages">;
  model?: string;
}

export async function processInboundEmail(email: InboundEmail, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const admin = createAdminClient();
  const contactEmail = normalizeEmail(email.from);

  // 0. Idempotence sur Message-ID (le Worker peut réessayer).
  if (email.messageId) {
    const { data } = await admin.from("email_messages").select("id").eq("message_id", email.messageId).maybeSingle();
    if (data) return { status: "duplicate" };
  }

  // 1. Garde-fous déterministes AVANT tout appel IA.
  let thread = await findThread(email);
  const decision = evaluateGuardrails({
    email,
    thread,
    ownAddresses: [env.emailReplyTo(), normalizeEmail(env.emailFrom()), siteConfig.supportEmail],
  });
  if (decision.action === "drop") return { status: "dropped", reason: decision.reason };

  const { prospect, business } = await loadContact(contactEmail, thread);

  // 2. Rattachement / création du fil puis stockage du message entrant.
  if (!thread) {
    const { data, error } = await admin
      .from("email_threads")
      .insert({
        contact_email: contactEmail,
        prospect_id: prospect?.id ?? null,
        business_id: business?.id ?? null,
        subject: email.subject.slice(0, 300),
        status: "open",
      })
      .select("*")
      .single<EmailThread>();
    if (error || !data) throw new Error(`thread insert: ${error?.message}`);
    thread = data;
  }

  const { data: inboundRow, error: inboundError } = await admin
    .from("email_messages")
    .insert({
      thread_id: thread.id,
      direction: "inbound",
      from_email: contactEmail,
      to_email: normalizeEmail(email.to),
      message_id: email.messageId,
      in_reply_to: email.inReplyTo,
      body_text: email.text.slice(0, 20000),
    })
    .select("id")
    .single<{ id: string }>();
  if (inboundError) {
    if (inboundError.code === "23505") return { status: "duplicate" };
    throw new Error(`message insert: ${inboundError.message}`);
  }

  const references = appendReference(thread.references_chain, email.messageId);
  await admin
    .from("email_threads")
    .update({ last_message_id: email.messageId ?? thread.last_message_id, references_chain: references, updated_at: new Date().toISOString() })
    .eq("id", thread.id);

  const setIntent = (intent: string) => admin.from("email_messages").update({ ai_intent: intent }).eq("id", inboundRow.id);
  const stopProspect = (status: "stopped" | "ooo_paused" | "replied") =>
    prospect && !["converted", "stopped"].includes(prospect.status)
      ? admin.from("prospects").update({ status, next_followup_at: null }).eq("id", prospect.id)
      : Promise.resolve();

  // 3. Opt-out & absence : traitement déterministe, aucune réponse.
  if (decision.action === "opt_out") {
    await Promise.all([admin.from("email_threads").update({ status: "stopped" }).eq("id", thread.id), stopProspect("stopped"), setIntent("opt_out"), suppressEmail(contactEmail, "unsubscribe")]);
    return { status: "opted_out" };
  }
  if (decision.action === "ooo_pause") {
    await Promise.all([stopProspect("ooo_paused"), setIntent("out_of_office")]);
    return { status: "ooo_paused" };
  }

  await stopProspect("replied");

  // 4. Contexte complet pour Claude.
  const { data: historyRows } = await admin
    .from("email_messages")
    .select("direction, body_text, created_at")
    .eq("thread_id", thread.id)
    .order("created_at")
    .returns<{ direction: "inbound" | "outbound"; body_text: string | null; created_at: string }[]>();
  const history = (historyRows ?? []).slice(0, -1).map((m) => ({ direction: m.direction, body: m.body_text ?? "", created_at: m.created_at }));
  const contact = await buildContactContext(prospect, business);
  const context: AgentContext = { inbound: email, contact, history, aiReplyCount: thread.ai_reply_count };

  const escalate = async (reason: string, draft: string, intent: string) => {
    await admin.from("email_threads").update({ status: "escalated" }).eq("id", thread.id);
    await setIntent(intent);
    await alertOwner({ reason, email, thread, contact, history: [...history, { direction: "inbound", body: email.text, created_at: new Date().toISOString() }], draft });
    return { status: "escalated" as const, reason };
  };

  const client = deps.anthropic ?? new Anthropic();
  const model = deps.model ?? env.anthropicModel();
  let agentDecision: AgentDecision;
  try {
    agentDecision = await decideReply(context, client, model);
  } catch (err) {
    await logEvent("email-agent.claude", errorMessage(err), { thread_id: thread.id });
    agentDecision = { intent: "escalate_human", should_reply: false, reply_body: "", escalation_reason: "API Claude indisponible" };
  }

  // Plafond atteint ou fil déjà escaladé : jamais d'envoi au contact, seulement l'alerte avec brouillon.
  if (decision.action === "escalate") {
    const reason = decision.reason === "reply_cap" ? "Plafond de 4 réponses automatiques atteint" : "Nouveau message sur un fil escaladé";
    return escalate(reason, agentDecision.reply_body, agentDecision.intent);
  }

  const onboardingUrl =
    contact.kind === "prospect" && prospect
      ? `${env.appUrl()}/pro/inscription?prefill=${encodeURIComponent(
          signPrefill({ name: prospect.name, city: prospect.city ?? "", email: prospect.email ?? contactEmail, ...(prospect.category ? { category: prospect.category } : {}) }, env.prefillSecret()),
        )}`
      : null;

  const final = finalizeDecision(agentDecision, context, { onboardingUrl, signature: SIGNATURE });

  switch (final.action) {
    case "opt_out":
      await Promise.all([admin.from("email_threads").update({ status: "stopped" }).eq("id", thread.id), stopProspect("stopped"), setIntent("opt_out"), suppressEmail(contactEmail, "unsubscribe")]);
      return { status: "opted_out" };
    case "ooo_pause":
      await Promise.all([stopProspect("ooo_paused"), setIntent("out_of_office")]);
      return { status: "ooo_paused" };
    case "none":
      await setIntent(final.intent);
      return { status: "no_reply" };
    case "escalate":
      return escalate(final.reason, final.draft, final.intent);
    case "reply": {
      const sent = await sendEmail({
        to: contactEmail,
        subject: replySubject(email.subject),
        text: final.body,
        inReplyTo: email.messageId,
        references,
      });
      await admin.from("email_messages").insert({
        thread_id: thread.id,
        direction: "outbound",
        from_email: normalizeEmail(env.emailFrom()),
        to_email: contactEmail,
        message_id: sent.messageId,
        in_reply_to: email.messageId,
        body_text: final.body,
        ai_intent: final.intent,
      });
      await admin.rpc("increment_ai_reply_count", { p_thread_id: thread.id });
      await admin
        .from("email_threads")
        .update({ status: "ai_handled", last_message_id: sent.messageId, references_chain: appendReference(references, sent.messageId) })
        .eq("id", thread.id);
      await setIntent(final.intent);
      return { status: "replied", messageId: sent.messageId };
    }
  }
}
