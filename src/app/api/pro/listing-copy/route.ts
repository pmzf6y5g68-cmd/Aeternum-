import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { writeListingCopy } from "@/lib/ai/listing-writer";
import { errorMessage, logEvent } from "@/lib/events";
import { json, jsonError } from "@/lib/http";
import { getApiBusiness } from "@/lib/pro";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OpeningHoursRow, Service } from "@/lib/supabase/types";

const DAILY_LIMIT = 10;
const bodySchema = z.object({ notes: z.string().max(1000).optional().default("") });

/** Rédaction IA de la fiche (proposition uniquement : le pro relit puis applique). */
export async function POST(request: Request) {
  const business = await getApiBusiness();
  if (!business) return jsonError("unauthorized", 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError("invalid", 400);
  if (!process.env.ANTHROPIC_API_KEY) return jsonError("ai_unavailable", 503);

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await admin.from("system_events").select("id", { count: "exact", head: true }).eq("source", "ai.listing").contains("context", { business_id: business.id }).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return jsonError("rate_limited", 429);

  const [{ data: services }, { data: hours }] = await Promise.all([
    admin.from("services").select("*").eq("business_id", business.id).eq("active", true).order("sort").returns<Service[]>(),
    admin.from("opening_hours").select("*").eq("business_id", business.id).returns<OpeningHoursRow[]>(),
  ]);
  try {
    const copy = await writeListingCopy({ business, services: services ?? [], hours: hours ?? [], notes: parsed.data.notes }, new Anthropic(), process.env.ANTHROPIC_MODEL || "claude-haiku-4-5");
    await logEvent("ai.listing", "listing copy generated", { business_id: business.id, ok: Boolean(copy) }, "info");
    if (!copy) return jsonError("ai_invalid", 502);
    return json(copy);
  } catch (err) {
    await logEvent("ai.listing", errorMessage(err), { business_id: business.id });
    return jsonError("ai_error", 502);
  }
}
