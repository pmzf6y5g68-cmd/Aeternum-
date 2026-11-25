import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { addDays, isValidDateString, zonedDateString } from "@/lib/domain/time";
import { json, jsonError } from "@/lib/http";
import { loadPublicBusiness } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

const schema = z.object({
  business: z.string().min(3).max(60),
  service_id: z.uuid().nullable().default(null),
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  date_from: z.string().refine(isValidDateString),
  days: z.number().int().min(1).max(31).default(14),
});

/** Inscription à la liste d'attente d'un établissement (alerte dès qu'un créneau se libère). */
export async function POST(request: Request) {
  if (!(await rateLimit("waitlist", request, 10, 3600))) return jsonError("rate_limited", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const input = parsed.data;
  const business = await loadPublicBusiness(input.business);
  if (!business) return jsonError("business_not_found", 404);

  const today = zonedDateString(new Date(), siteConfig.booking.timeZone);
  const from = input.date_from < today ? today : input.date_from;
  const to = addDays(from, input.days - 1);
  const session = await createSessionClient();
  const { data: auth } = await session.auth.getUser();

  const { error } = await createAdminClient().from("waitlist_entries").insert({
    business_id: business.id,
    service_id: input.service_id,
    user_id: auth.user?.id ?? null,
    name: input.name,
    email: input.email,
    date_from: from,
    date_to: to,
  });
  if (error && error.code !== "23505") return jsonError("server_error", 500);
  return json({ ok: true, date_from: from, date_to: to });
}
