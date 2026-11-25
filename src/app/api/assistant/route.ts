import { rateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { assistantRequestSchema, runAssistant } from "@/lib/ai/assistant";
import { executeAssistantTool } from "@/lib/ai/assistant-tools";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { createSessionClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Limite de débit best effort par instance : 20 messages / 10 min / IP.
const WINDOW_MS = 10 * 60_000;
const LIMIT = 20;
const hits = new Map<string, number[]>();

function allowed(ip: string, now: number = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return true;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError("assistant_unavailable", 503);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowed(ip) || !(await rateLimit("assistant", request, 60, 3600))) return jsonError("rate_limited", 429);

  const parsed = assistantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");

  const session = await createSessionClient();
  const { data: auth } = await session.auth.getUser();
  try {
    const result = await runAssistant(parsed.data, {
      client: new Anthropic(),
      execute: executeAssistantTool,
      model: process.env.ASSISTANT_MODEL || "claude-opus-5-5",
      userId: auth.user?.id ?? null,
    });
    return json(result);
  } catch (err) {
    await logEvent("assistant", errorMessage(err));
    return jsonError("assistant_error", 502);
  }
}
