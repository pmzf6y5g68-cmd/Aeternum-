/**
 * Cloudflare Email Worker : reçoit les emails via Email Routing, les parse avec postal-mime
 * et les transmet en JSON signé à POST https://${APP_DOMAIN}/api/webhooks/inbound-email.
 */
import PostalMime, { type Address, type Email } from "postal-mime";

export interface Env {
  APP_DOMAIN: string;
  INBOUND_SECRET: string;
  FALLBACK_FORWARD?: string;
}

/** En-têtes transmis à l'API pour les garde-fous anti-boucle. */
const FORWARDED_HEADERS = [
  "auto-submitted",
  "precedence",
  "x-autoreply",
  "x-autorespond",
  "x-auto-response-suppress",
  "list-id",
  "list-unsubscribe",
  "x-failed-recipients",
  "return-path",
  "content-type",
];

const MAX_TEXT = 100_000;

function firstMailbox(address: Address | undefined): { address: string; name: string } | null {
  if (!address) return null;
  if (address.address) return { address: address.address, name: address.name };
  const member = address.group?.[0];
  return member ? { address: member.address, name: member.name } : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildPayload(parsed: Email, envelopeFrom: string, envelopeTo: string) {
  const headers: Record<string, string> = {};
  for (const h of parsed.headers) {
    const key = h.key.toLowerCase();
    if (FORWARDED_HEADERS.includes(key) && headers[key] === undefined) headers[key] = h.value.slice(0, 2000);
  }
  const from = firstMailbox(parsed.from);
  const text = parsed.text?.trim() ? parsed.text : parsed.html ? htmlToText(parsed.html) : "";
  return {
    from: from?.address ?? envelopeFrom,
    fromName: from?.name || null,
    to: envelopeTo,
    subject: parsed.subject ?? "",
    text: text.slice(0, MAX_TEXT),
    messageId: parsed.messageId ?? null,
    inReplyTo: parsed.inReplyTo ?? null,
    references: parsed.references ?? null,
    headers,
  };
}

async function postWithRetry(url: string, body: string, secret: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Inbound-Secret": secret },
      body,
    });
    // 2xx = traité, 4xx = rejet définitif (signature, payload) : inutile de réessayer.
    if (last.status < 500) return last;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  return last as Response;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const parsed = await PostalMime.parse(message.raw);
    const payload = buildPayload(parsed, message.from, message.to);
    const url = `https://${env.APP_DOMAIN}/api/webhooks/inbound-email`;

    let ok = false;
    try {
      const res = await postWithRetry(url, JSON.stringify(payload), env.INBOUND_SECRET);
      ok = res.ok;
      if (!ok) console.error("inbound webhook rejected", res.status, await res.text());
    } catch (err) {
      console.error("inbound webhook unreachable", err);
    }

    if (!ok && env.FALLBACK_FORWARD) {
      await message.forward(env.FALLBACK_FORWARD);
    }
  },
} satisfies ExportedHandler<Env>;
