import { z } from "zod";
import { loadPublicStudio, resolveDistance } from "@/lib/booking-engine";
import { centsToEur } from "@/lib/domain/pricing";
import { json, jsonError } from "@/lib/http";

const schema = z.object({
  slug: z.string().min(3).max(50),
  address: z.string().trim().min(5).max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");

  const studio = await loadPublicStudio(parsed.data.slug);
  if (!studio) return jsonError("studio_not_found", 404);
  if (studio.service_mode === "workshop") return jsonError("mobile_not_offered");

  const result = await resolveDistance(studio, parsed.data.address);
  if (!result) return jsonError("address_not_found", 422);

  return json({
    label: result.label,
    distance_km: result.distanceKm,
    travel_fee_eur: centsToEur(result.feeCents),
    out_of_zone: result.outOfZone,
  });
}
