"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VEHICLE_SIZES, type SizePricingMap } from "@/lib/domain/pricing";
import { geocodeAddress } from "@/lib/domain/geocode";
import { notifyClientCancelledByStudio } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { requireStudio } from "@/lib/studio";
import type { Booking } from "@/lib/supabase/types";

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);
const optionalNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().min(min).max(max).optional());

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------
const STUDIO_STATUSES = ["confirmed", "completed", "no_show", "cancelled"] as const;

export async function updateBookingStatus(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const id = z.uuid().parse(formData.get("id"));
  const status = z.enum(STUDIO_STATUSES).parse(formData.get("status"));

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .eq("studio_id", studio.id)
    .maybeSingle<Booking>();
  if (!booking) return;

  const { error } = await supabase.from("bookings").update({ status }).eq("id", id).eq("studio_id", studio.id);
  if (error) {
    await logEvent("dashboard.updateBookingStatus", error.message, { id, status });
    return;
  }
  if (status === "cancelled" && booking.status !== "cancelled" && new Date(booking.start_at) > new Date()) {
    try {
      await notifyClientCancelledByStudio(booking, studio);
    } catch (err) {
      await logEvent("dashboard.cancelEmail", errorMessage(err), { id });
    }
  }
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Prestations
// ---------------------------------------------------------------------------
const serviceSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional().default(""),
  base_price_eur: num(0, 10000),
  base_duration_minutes: num(15, 1440),
  active: z.literal("on").optional(),
});

function readSizePricing(formData: FormData): SizePricingMap {
  const map: SizePricingMap = {};
  for (const size of VEHICLE_SIZES) {
    const price = optionalNum(0, 10000).parse(formData.get(`price_${size}`));
    const duration = optionalNum(15, 1440).parse(formData.get(`duration_${size}`));
    if (price !== undefined && duration !== undefined) map[size] = { price_eur: price, duration_minutes: Math.round(duration) };
  }
  return map;
}

export async function upsertService(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const input = serviceSchema.parse(Object.fromEntries(formData));
  const row = {
    studio_id: studio.id,
    name: input.name,
    description: input.description || null,
    base_price_eur: input.base_price_eur,
    base_duration_minutes: Math.round(input.base_duration_minutes),
    size_pricing_json: readSizePricing(formData),
    active: input.active === "on",
  };
  const result = input.id
    ? await supabase.from("services").update(row).eq("id", input.id).eq("studio_id", studio.id)
    : await supabase.from("services").insert(row);
  if (result.error) await logEvent("dashboard.upsertService", result.error.message);
  revalidatePath("/dashboard/services");
}

export async function deleteService(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const id = z.uuid().parse(formData.get("id"));
  await supabase.from("services").delete().eq("id", id).eq("studio_id", studio.id);
  revalidatePath("/dashboard/services");
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
const addonSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(80),
  price_eur: num(0, 10000),
  duration_minutes: num(0, 600),
  active: z.literal("on").optional(),
});

export async function upsertAddon(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const input = addonSchema.parse(Object.fromEntries(formData));
  const row = {
    studio_id: studio.id,
    name: input.name,
    price_eur: input.price_eur,
    duration_minutes: Math.round(input.duration_minutes),
    active: input.active === "on",
  };
  const result = input.id
    ? await supabase.from("addons").update(row).eq("id", input.id).eq("studio_id", studio.id)
    : await supabase.from("addons").insert(row);
  if (result.error) await logEvent("dashboard.upsertAddon", result.error.message);
  revalidatePath("/dashboard/services");
}

export async function deleteAddon(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const id = z.uuid().parse(formData.get("id"));
  await supabase.from("addons").delete().eq("id", id).eq("studio_id", studio.id);
  revalidatePath("/dashboard/services");
}

// ---------------------------------------------------------------------------
// Zone mobile & réglages
// ---------------------------------------------------------------------------
const zoneSchema = z
  .object({
    service_mode: z.enum(["workshop", "mobile", "both"]),
    address: z.string().trim().min(5).max(200),
    free_radius_km: num(0, 300),
    max_radius_km: num(0, 300),
    price_per_extra_km: num(0, 50),
    travel_buffer_minutes: num(0, 240),
    rebooking_days: num(7, 730),
  })
  .refine((v) => v.max_radius_km >= v.free_radius_km, { path: ["max_radius_km"] });

export async function updateZone(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const input = zoneSchema.parse(Object.fromEntries(formData));
  const patch: Record<string, unknown> = {
    service_mode: input.service_mode,
    free_radius_km: input.free_radius_km,
    max_radius_km: input.max_radius_km,
    price_per_extra_km: input.price_per_extra_km,
    travel_buffer_minutes: Math.round(input.travel_buffer_minutes),
    rebooking_days: Math.round(input.rebooking_days),
  };
  if (input.address !== studio.address) {
    const geo = await geocodeAddress(input.address);
    if (geo) Object.assign(patch, { address: geo.label, city: geo.city ?? studio.city, base_lat: geo.lat, base_lng: geo.lng });
  }
  const { error } = await supabase.from("studios").update(patch).eq("id", studio.id);
  if (error) await logEvent("dashboard.updateZone", error.message);
  revalidatePath("/dashboard/services");
}

// ---------------------------------------------------------------------------
// Horaires
// ---------------------------------------------------------------------------
const timeOrEmpty = z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{2}:\d{2}$/).nullable());

export async function updateHours(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const isClosed = formData.get(`closed_${day}`) === "on";
    const open = timeOrEmpty.parse(formData.get(`open_${day}`) ?? "");
    const close = timeOrEmpty.parse(formData.get(`close_${day}`) ?? "");
    const breakStart = timeOrEmpty.parse(formData.get(`break_start_${day}`) ?? "");
    const breakEnd = timeOrEmpty.parse(formData.get(`break_end_${day}`) ?? "");
    const valid = !isClosed && open && close && open < close;
    const validBreak = valid && breakStart && breakEnd && breakStart < breakEnd && breakStart >= open && breakEnd <= close;
    return {
      studio_id: studio.id,
      day_of_week: day,
      is_closed: !valid,
      open_time: valid ? open : null,
      close_time: valid ? close : null,
      break_start: validBreak ? breakStart : null,
      break_end: validBreak ? breakEnd : null,
    };
  });
  const { error } = await supabase.from("opening_hours").upsert(rows, { onConflict: "studio_id,day_of_week" });
  if (error) await logEvent("dashboard.updateHours", error.message);
  revalidatePath("/dashboard/services");
}

// ---------------------------------------------------------------------------
// Acomptes
// ---------------------------------------------------------------------------
export async function updateDepositSettings(formData: FormData): Promise<void> {
  const { supabase, studio } = await requireStudio();
  const percent = num(5, 100).parse(formData.get("deposit_percent"));
  const enabled = formData.get("deposit_enabled") === "on" && studio.stripe_connect_onboarded;
  const { error } = await supabase
    .from("studios")
    .update({ deposit_enabled: enabled, deposit_percent: Math.round(percent) })
    .eq("id", studio.id);
  if (error) await logEvent("dashboard.updateDepositSettings", error.message);
  revalidatePath("/dashboard/billing");
}
