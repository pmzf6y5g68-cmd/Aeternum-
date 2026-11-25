import { type NextRequest } from "next/server";
import { z } from "zod";
import { computeSlotsForDate, loadCatalog, loadPublicStudio, locationAllowed, pricingStudio } from "@/lib/booking-engine";
import { VEHICLE_SIZES, computeQuote } from "@/lib/domain/pricing";
import { isValidDateString } from "@/lib/domain/time";
import { json, jsonError } from "@/lib/http";

const schema = z.object({
  slug: z.string().min(3).max(50),
  date: z.string().refine(isValidDateString),
  service_id: z.uuid(),
  size: z.enum(VEHICLE_SIZES),
  location: z.enum(["workshop", "mobile"]),
  addons: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(20)),
});

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("invalid_request");
  const q = parsed.data;

  const studio = await loadPublicStudio(q.slug);
  if (!studio) return jsonError("studio_not_found", 404);
  if (!locationAllowed(studio, q.location)) return jsonError("location_not_offered");

  const { services, addons } = await loadCatalog(studio);
  const service = services.find((s) => s.id === q.service_id);
  if (!service) return jsonError("service_not_found", 404);
  const chosenAddons = addons.filter((a) => q.addons.includes(a.id));

  // La durée bloquée ne dépend que du lieu (tampon trajet), pas de la distance exacte.
  const quote = computeQuote({
    service,
    addons: chosenAddons,
    size: q.size,
    locationType: q.location,
    distanceKm: q.location === "mobile" ? 0 : null,
    studio: pricingStudio(studio),
  });

  const slots = await computeSlotsForDate(studio.id, q.date, quote.blockedMinutes);
  return json({ date: q.date, duration_minutes: quote.blockedMinutes, slots });
}
