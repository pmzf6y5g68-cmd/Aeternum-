import "server-only";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { env } from "@/lib/env";

let cached: Resend | null = null;
function resend(): Resend {
  if (!cached) cached = new Resend(env.resendApiKey());
  return cached;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  from?: string;
  /** Message-ID du message auquel on répond (threading Gmail / Outlook). */
  inReplyTo?: string | null;
  /** Chaîne References complète (séparée par des espaces). */
  references?: string | null;
  attachments?: { filename: string; content: string; contentType?: string }[];
  extraHeaders?: Record<string, string>;
}

export interface SendEmailResult {
  messageId: string;
  providerId: string | null;
}

export function generateMessageId(): string {
  const domain = (process.env.APP_DOMAIN ?? "rendez-vous.app").replace(/^https?:\/\//, "");
  return `<${randomUUID()}@${domain}>`;
}

/** Envoie via Resend en fixant nous-mêmes Message-ID / In-Reply-To / References. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const messageId = generateMessageId();
  const headers: Record<string, string> = { "Message-ID": messageId, ...input.extraHeaders };
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers["References"] = input.references;

  const { data, error } = await resend().emails.send({
    from: input.from ?? env.emailFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo ?? env.emailReplyTo(),
    headers,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString("base64"),
      contentType: a.contentType,
    })),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { messageId, providerId: data?.id ?? null };
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Gabarit HTML sobre partagé par les emails transactionnels. */
export function layoutHtml(title: string, paragraphs: string[], cta?: { label: string; url: string }[]): string {
  const buttons = (cta ?? [])
    .map(
      (b, i) =>
        `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:8px 8px 0 0;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;${
          i === 0 ? "background:#1758E6;color:#ffffff" : "background:#F8FAFC;color:#0F172A;border:1px solid #E2E8F0"
        }">${escapeHtml(b.label)}</a>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A">
<div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
${buttons}
</div><p style="font-size:12px;color:#64748B;text-align:center;margin-top:16px">Envoyé par Rendez-vous</p></div></body></html>`;
}
