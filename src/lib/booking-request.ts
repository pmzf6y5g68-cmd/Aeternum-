import "server-only";
import { z } from "zod";
import { LOCATION_MODES, type LocationMode } from "@/config/categories";
import { computeQuote, type Quote } from "@/lib/domain/pricing";
import { eligibleStaffIds, loadCatalog, pricingOf, type BusinessCatalog } from "@/lib/marketplace";
import type { PublicBusiness, Service } from "@/lib/supabase/types";

export const locationSchema = z.enum(LOCATION_MODES as [LocationMode, ...LocationMode[]]);

export class BookingInputError extends Error {}

export interface ResolvedSelection {
  catalog: BusinessCatalog;
  service: Service;
  location: LocationMode;
  addons: BusinessCatalog["addons"];
  staffIds: string[];
  requestedStaffId: string | null;
  seats: number;
  /** Devis sans frais km (distance calculée à part pour le domicile). */
  baseQuote: Quote;
}

/** Valide la sélection de l'usager contre le catalogue réel (jamais contre le client). */
export async function resolveSelection(
  business: PublicBusiness,
  input: { serviceId: string; variantKey: string | null; location: LocationMode; addonIds: string[]; staffId: string | null; seats: number },
): Promise<ResolvedSelection> {
  const catalog = await loadCatalog(business);
  const service = catalog.services.find((s) => s.id === input.serviceId);
  if (!service) throw new BookingInputError("service_not_found");

  const allowedModes = service.modes.length ? service.modes.filter((m) => business.modes.includes(m)) : business.modes;
  if (!(allowedModes.length ? allowedModes : business.modes).includes(input.location)) throw new BookingInputError("location_not_offered");

  const addons = catalog.addons.filter((a) => input.addonIds.includes(a.id));
  const staffIds = eligibleStaffIds(catalog.staff, service.id);
  if (catalog.staff.length > 0 && staffIds.length === 0) throw new BookingInputError("no_staff");
  if (input.staffId && !staffIds.includes(input.staffId)) throw new BookingInputError("staff_not_found");

  const groupService = service.capacity > 1 && service.variants.length === 0;
  const seats = groupService ? Math.min(Math.max(1, input.seats), service.capacity) : 1;

  let baseQuote: Quote;
  try {
    baseQuote = computeQuote({
      service,
      variantKey: input.variantKey,
      addons,
      seats,
      locationType: input.location,
      distanceKm: input.location === "at_home" ? 0 : null,
      business: pricingOf(business),
    });
  } catch {
    throw new BookingInputError("variant_required");
  }
  return { catalog, service, location: input.location, addons, staffIds, requestedStaffId: input.staffId, seats, baseQuote };
}
