import { type NextRequest } from "next/server";
import { z } from "zod";
import { BookingInputError, locationSchema, resolveSelection } from "@/lib/booking-request";
import { isValidDateString } from "@/lib/domain/time";
import { json, jsonError } from "@/lib/http";
import { computeSlotWindow, loadPublicBusiness } from "@/lib/marketplace";

const schema = z.object({
  business: z.string().min(3).max(60),
  service: z.uuid(),
  variant: z.string().max(40).optional(),
  location: locationSchema,
  staff: z.uuid().optional(),
  addons: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(20)),
  seats: z.coerce.number().int().min(1).max(50).default(1),
  start: z.string().refine(isValidDateString),
  days: z.coerce.number().int().min(1).max(14).default(5),
});

/** Créneaux libres recalculés côté serveur pour une sélection complète. */
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("invalid_request");
  const q = parsed.data;

  const business = await loadPublicBusiness(q.business);
  if (!business) return jsonError("business_not_found", 404);

  try {
    const sel = await resolveSelection(business, {
      serviceId: q.service,
      variantKey: q.variant ?? null,
      location: q.location,
      addonIds: q.addons,
      staffId: q.staff ?? null,
      seats: q.seats,
    });
    const window = await computeSlotWindow({
      business,
      serviceId: sel.service.id,
      capacity: sel.service.capacity,
      durationMinutes: sel.baseQuote.blockedMinutes,
      staffIds: sel.staffIds,
      requestedStaffId: sel.requestedStaffId,
      seats: sel.seats,
      startDate: q.start,
      days: q.days,
    });
    return json({
      duration_minutes: sel.baseQuote.blockedMinutes,
      next_available: window.nextAvailable,
      days: window.days.map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ time: s.time, startAt: s.startAt, remaining: s.remaining })) })),
    });
  } catch (err) {
    if (err instanceof BookingInputError) return jsonError(err.message);
    throw err;
  }
}
