import { z } from "zod";
import { processInboundEmail } from "@/lib/ai/inbound-pipeline";
import type { InboundEmail } from "@/lib/ai/email-guardrails";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { safeEqual } from "@/lib/prefill";

export const maxDuration = 60;

const payloadSchema = z.object({
  from: z.string().min(3).max(320),
  fromName: z.string().max(200).nullable().optional(),
  to: z.string().min(3).max(320),
  subject: z.string().max(1000).default(""),
  text: z.string().max(200_000).default(""),
  messageId: z.string().max(998).nullable().default(null),
  inReplyTo: z.string().max(998).nullable().default(null),
  references: z.string().max(20_000).nullable().default(null),
  headers: z.record(z.string(), z.string().max(2000)).default({}),
});

export async function POST(request: Request) {
  if (!safeEqual(request.headers.get("x-inbound-secret"), env.inboundSecret())) {
    return jsonError("unauthorized", 401);
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const email: InboundEmail = {
    ...parsed.data,
    fromName: parsed.data.fromName ?? null,
    headers: Object.fromEntries(Object.entries(parsed.data.headers).map(([k, v]) => [k.toLowerCase(), v])),
  };

  try {
    const result = await processInboundEmail(email);
    return json(result);
  } catch (err) {
    await logEvent("webhook.inbound-email", errorMessage(err), { from: email.from, messageId: email.messageId });
    return jsonError("processing_failed", 500);
  }
}
