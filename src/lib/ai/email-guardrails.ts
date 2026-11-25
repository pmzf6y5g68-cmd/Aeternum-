/**
 * Garde-fous déterministes de l'agent email : exécutés AVANT tout appel IA.
 * Ils empêchent les boucles entre robots, honorent immédiatement les opt-out
 * et plafonnent le nombre de réponses automatiques par fil.
 */
export const MAX_AI_REPLIES = 4;

export interface InboundEmail {
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  text: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  /** En-têtes (clés en minuscules). */
  headers: Record<string, string>;
}

export interface ThreadState {
  status: "open" | "ai_handled" | "escalated" | "stopped";
  ai_reply_count: number;
}

export type GuardrailDecision =
  | { action: "drop"; reason: "system_address" | "automated_header" | "thread_stopped" | "empty_body" | "self_sent" }
  | { action: "ooo_pause"; reason: "out_of_office" }
  | { action: "opt_out"; reason: "stop_keyword" }
  | { action: "escalate"; reason: "reply_cap" | "already_escalated" }
  | { action: "ai" };

const SYSTEM_LOCAL_PART =
  /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|daemon|notifications?|auto-?reply|autoresponder)([+._-].*)?$/i;

export function normalizeEmail(address: string): string {
  const match = address.match(/<([^>]+)>/);
  return (match?.[1] ?? address).trim().toLowerCase();
}

export function isSystemAddress(address: string): boolean {
  const email = normalizeEmail(address);
  const local = email.split("@")[0] ?? "";
  return SYSTEM_LOCAL_PART.test(local) || email.includes("mailer-daemon");
}

function header(headers: Record<string, string>, name: string): string | undefined {
  const v = headers[name.toLowerCase()];
  return v === undefined ? undefined : v.trim().toLowerCase();
}

/** En-têtes RFC 3834 & usages courants des répondeurs / listes. */
export function isAutomatedMessage(headers: Record<string, string>): boolean {
  const autoSubmitted = header(headers, "auto-submitted");
  if (autoSubmitted && autoSubmitted !== "no") return true;
  const precedence = header(headers, "precedence");
  if (precedence && ["bulk", "list", "auto_reply", "auto-reply", "junk"].includes(precedence)) return true;
  if (header(headers, "x-autoreply") !== undefined) return true;
  if (header(headers, "x-autorespond") !== undefined) return true;
  if (header(headers, "x-auto-response-suppress")?.match(/\b(all|oof|autoreply)\b/)) return true;
  if (header(headers, "list-id") !== undefined) return true;
  if (header(headers, "x-failed-recipients") !== undefined) return true;
  return false;
}

const OOO_PATTERN =
  /(out of (the )?office|automatic reply|auto(matic)?[- ]?reply|absence du bureau|absent(e)? du bureau|r[ée]ponse automatique|en cong[ée]s?|je suis absent|actuellement absent|de retour le|back on)/i;

export function looksLikeOutOfOffice(subject: string, text: string): boolean {
  return OOO_PATTERN.test(subject) || OOO_PATTERN.test(text.slice(0, 600));
}

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Ne conserve que le texte nouvellement écrit (retire citations et historique). */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(le .+a [ée]crit ?:|on .+wrote:|-----\s*original message|de ?: .+|from: .+|envoy[ée] ?: )/i.test(trimmed)) break;
    if (/^_{5,}$/.test(trimmed)) break;
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

const STOP_PATTERN =
  /(^|[^a-z0-9-])(stop|arretez|desinscri\w*|desabonn\w*|unsubscribe|unsuscribe|remove me|retirez[- ]moi|ne plus (me )?(contacter|recevoir)|plus de mails?|pas interesse(e)?[ ,.!]*(merci)?$)([^a-z0-9-]|$)/im;

export function containsStopKeyword(subject: string, text: string): boolean {
  const fresh = stripAccents(`${subject}\n${stripQuotedReply(text)}`.toLowerCase());
  return STOP_PATTERN.test(fresh);
}

export interface GuardrailInput {
  email: InboundEmail;
  thread: ThreadState | null;
  /** Adresses du domaine Rendez-vous (évite de se répondre à soi-même). */
  ownAddresses: string[];
}

export function evaluateGuardrails({ email, thread, ownAddresses }: GuardrailInput): GuardrailDecision {
  const from = normalizeEmail(email.from);
  if (ownAddresses.map(normalizeEmail).includes(from)) return { action: "drop", reason: "self_sent" };
  if (isSystemAddress(from)) return { action: "drop", reason: "system_address" };

  if (isAutomatedMessage(email.headers)) {
    if (looksLikeOutOfOffice(email.subject, email.text)) return { action: "ooo_pause", reason: "out_of_office" };
    return { action: "drop", reason: "automated_header" };
  }

  if (thread?.status === "stopped") return { action: "drop", reason: "thread_stopped" };

  if (containsStopKeyword(email.subject, email.text)) return { action: "opt_out", reason: "stop_keyword" };

  if (!stripQuotedReply(email.text)) return { action: "drop", reason: "empty_body" };

  if (thread?.status === "escalated") return { action: "escalate", reason: "already_escalated" };
  if (thread && thread.ai_reply_count >= MAX_AI_REPLIES) return { action: "escalate", reason: "reply_cap" };

  return { action: "ai" };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
