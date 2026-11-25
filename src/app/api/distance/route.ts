import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { centsToEur } from "@/lib/domain/pricing";
import { json, jsonError } from "@/lib/http";
import { loadPublicBusiness, resolveDistance } from "@/lib/marketplace";

const schema = z.object({ business: z.string().min(3).max(60), address: z.string().trim().min(5).max(200) });

export async function POST(request: Request) {
  if (!(await rateLimit("distance", request, 60, 600))) return jsonError("rate_limited", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const business = await loadPublicBusiness(parsed.data.business);
  if (!business) return jsonError("business_not_found", 404);
  if (!business.modes.includes("at_home")) return jsonError("at_home_not_offered");
  const result = await resolveDistance(business, parsed.data.address);
  if (!result) return jsonError("address_not_found", 422);
  return json({ label: result.label, distance_km: result.distanceKm, travel_fee_eur: centsToEur(result.feeCents), out_of_zone: result.outOfZone });
}
