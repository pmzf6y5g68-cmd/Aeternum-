import { z } from "zod";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { suppressEmail } from "@/lib/suppression";
import { verifySvix } from "@/lib/unsubscribe";

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().optional(),
    to: z.union([z.array(z.string()), z.string()]).optional(),
    bounce: z.object({ type: z.string().optional() }).passthrough().optional(),
  }).passthrough(),
});

/**
 * Événements Resend (signés Svix) : rebonds et plaintes alimentent la liste de suppression
 * et les taux qui freinent automatiquement la prospection.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const ok = verifySvix(
    payload,
    { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") },
    env.resendWebhookSecret(),
  );
  if (!ok) return jsonError("invalid_signature", 401);

  const parsed = eventSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) return json({ ignored: true });
  const { type, data } = parsed.data;
  const recipients = (Array.isArray(data.to) ? data.to : data.to ? [data.to] : []).map((e) => e.toLowerCase());

  try {
    const rows: { provider_id: string | null; email: string | null; type: string }[] = recipients.length
      ? recipients.map((email) => ({ provider_id: data.email_id ?? null, email, type }))
      : [{ provider_id: data.email_id ?? null, email: null, type }];
    await createAdminClient().from("email_events").insert(rows);
    const permanentBounce = type === "email.bounced" && (data.bounce?.type ?? "Permanent").toLowerCase() !== "transient";
    if (permanentBounce) for (const email of recipients) await suppressEmail(email, "bounce");
    if (type === "email.complained") for (const email of recipients) await suppressEmail(email, "complaint");
  } catch (err) {
    await logEvent("webhook.resend", errorMessage(err), { type });
    return jsonError("handler_error", 500);
  }
  return json({ received: true });
}
