"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCATION_MODES, type LocationMode } from "@/config/categories";
import { geocodeAddress } from "@/lib/domain/geocode";
import type { Variant } from "@/lib/domain/pricing";
import { zonedTimeToUtc } from "@/lib/domain/time";
import { BUSINESS_CONTACT_COLUMNS, notifyClientCancelledByBusiness, sendReviewRequest, type BusinessContact } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { requireBusiness } from "@/lib/pro";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/supabase/types";

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);
const optionalNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().min(min).max(max).optional());
const checkbox = (formData: FormData, name: string) => formData.get(name) === "on";
const modesFrom = (formData: FormData, name = "modes"): LocationMode[] =>
  formData.getAll(name).map(String).filter((m): m is LocationMode => (LOCATION_MODES as string[]).includes(m));
const lines = (value: FormDataEntryValue | null, max: number) =>
  String(value ?? "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((s) => s.slice(0, 60));

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------
const PRO_STATUSES = ["confirmed", "completed", "no_show", "cancelled"] as const;

export async function updateBookingStatus(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const id = z.uuid().parse(formData.get("id"));
  const status = z.enum(PRO_STATUSES).parse(formData.get("status"));
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).eq("business_id", business.id).maybeSingle<Booking>();
  if (!booking) return;

  const { error } = await supabase.from("bookings").update({ status }).eq("id", id).eq("business_id", business.id);
  if (error) {
    await logEvent("pro.updateBookingStatus", error.message, { id, status });
    return;
  }
  const admin = createAdminClient();
  if (status === "cancelled") await admin.from("bookings").update({ cancelled_by: "business" }).eq("id", id);
  try {
    const { data: contact } = await admin.from("businesses").select(BUSINESS_CONTACT_COLUMNS).eq("id", business.id).single<BusinessContact>();
    if (contact && status === "cancelled" && booking.status !== "cancelled" && new Date(booking.start_at) > new Date()) {
      await notifyClientCancelledByBusiness(booking, contact);
    }
    if (contact && status === "completed" && !booking.review_requested) {
      await admin.from("bookings").update({ review_requested: true }).eq("id", id);
      await sendReviewRequest(booking, contact);
    }
  } catch (err) {
    await logEvent("pro.bookingEmail", errorMessage(err), { id, status }, "warning");
  }
  revalidatePath("/pro/agenda");
}

export async function reassignBooking(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const id = z.uuid().parse(formData.get("id"));
  const staffId = z.uuid().parse(formData.get("staff_id"));
  const { data: staff } = await supabase.from("staff").select("id").eq("id", staffId).eq("business_id", business.id).maybeSingle();
  if (staff) await supabase.from("bookings").update({ staff_id: staffId }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/pro/agenda");
}

// ---------------------------------------------------------------------------
// Prestations
// ---------------------------------------------------------------------------
const serviceSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional().default(""),
  price_eur: num(0, 100000),
  duration_minutes: num(5, 1440),
  capacity: num(1, 500).default(1),
});

function readVariants(formData: FormData): Variant[] {
  const out: Variant[] = [];
  for (let i = 0; i < 8; i++) {
    const label = String(formData.get(`variant_label_${i}`) ?? "").trim().slice(0, 60);
    const price = optionalNum(0, 100000).parse(formData.get(`variant_price_${i}`));
    const duration = optionalNum(5, 1440).parse(formData.get(`variant_duration_${i}`));
    if (!label || price === undefined || duration === undefined) continue;
    const key = slugify(label) || `v${i}`;
    if (out.some((v) => v.key === key)) continue;
    out.push({ key, label, price_eur: price, duration_minutes: Math.round(duration) });
  }
  return out;
}

export async function upsertService(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const input = serviceSchema.parse(Object.fromEntries(formData));
  const row = {
    business_id: business.id,
    name: input.name,
    description: input.description || null,
    price_eur: input.price_eur,
    duration_minutes: Math.round(input.duration_minutes),
    variants: readVariants(formData),
    capacity: Math.round(input.capacity),
    modes: modesFrom(formData).filter((m) => business.modes.includes(m)),
    active: checkbox(formData, "active"),
  };
  const result = input.id
    ? await supabase.from("services").update(row).eq("id", input.id).eq("business_id", business.id)
    : await supabase.from("services").insert(row);
  if (result.error) await logEvent("pro.upsertService", result.error.message);
  revalidatePath("/pro/prestations");
}

export async function deleteService(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  await supabase.from("services").delete().eq("id", z.uuid().parse(formData.get("id"))).eq("business_id", business.id);
  revalidatePath("/pro/prestations");
}

const addonSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(80),
  price_eur: num(0, 10000),
  duration_minutes: num(0, 600),
});

export async function upsertAddon(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const input = addonSchema.parse(Object.fromEntries(formData));
  const row = { business_id: business.id, name: input.name, price_eur: input.price_eur, duration_minutes: Math.round(input.duration_minutes), active: checkbox(formData, "active") };
  const result = input.id ? await supabase.from("addons").update(row).eq("id", input.id).eq("business_id", business.id) : await supabase.from("addons").insert(row);
  if (result.error) await logEvent("pro.upsertAddon", result.error.message);
  revalidatePath("/pro/prestations");
}

export async function deleteAddon(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  await supabase.from("addons").delete().eq("id", z.uuid().parse(formData.get("id"))).eq("business_id", business.id);
  revalidatePath("/pro/prestations");
}

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------
const staffSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(60),
  title: z.string().trim().max(60).optional().default(""),
});

export async function upsertStaff(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const input = staffSchema.parse(Object.fromEntries(formData));
  const serviceIds = formData.getAll("service_ids").map(String).filter((s) => z.uuid().safeParse(s).success);
  const row = { business_id: business.id, name: input.name, title: input.title || null, service_ids: serviceIds, active: checkbox(formData, "active") };

  if (input.id) {
    const { error } = await supabase.from("staff").update(row).eq("id", input.id).eq("business_id", business.id);
    if (error) await logEvent("pro.upsertStaff", error.message);
  } else {
    const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("business_id", business.id);
    const { data, error } = await supabase.from("staff").insert({ ...row, sort: count ?? 0 }).select("id").single<{ id: string }>();
    if (error || !data) await logEvent("pro.upsertStaff", error?.message ?? "insert");
    // Premier membre : les RDV à venir sans membre lui sont attribués (sinon ils ne bloqueraient plus l'agenda).
    if (data && (count ?? 0) === 0) {
      await createAdminClient().from("bookings").update({ staff_id: data.id }).eq("business_id", business.id).is("staff_id", null).gte("end_at", new Date().toISOString());
    }
  }
  revalidatePath("/pro/equipe");
}

export async function deleteStaff(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const id = z.uuid().parse(formData.get("id"));
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("staff_id", id)
    .gte("end_at", new Date().toISOString())
    .not("status", "in", "(cancelled,no_show)");
  // Un membre avec des RDV à venir est désactivé plutôt que supprimé.
  if ((count ?? 0) > 0) await supabase.from("staff").update({ active: false }).eq("id", id).eq("business_id", business.id);
  else await supabase.from("staff").delete().eq("id", id).eq("business_id", business.id);
  revalidatePath("/pro/equipe");
}

// ---------------------------------------------------------------------------
// Horaires & congés
// ---------------------------------------------------------------------------
const timeOrEmpty = z.preprocess((v) => (v === "" || v === null ? null : v), z.string().regex(/^\d{2}:\d{2}$/).nullable());

export async function updateHours(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const closed = checkbox(formData, `closed_${day}`);
    const open = timeOrEmpty.parse(formData.get(`open_${day}`) ?? "");
    const close = timeOrEmpty.parse(formData.get(`close_${day}`) ?? "");
    const bs = timeOrEmpty.parse(formData.get(`break_start_${day}`) ?? "");
    const be = timeOrEmpty.parse(formData.get(`break_end_${day}`) ?? "");
    const valid = !closed && open && close && open < close;
    const validBreak = valid && bs && be && bs < be && bs >= open && be <= close;
    return {
      business_id: business.id,
      day_of_week: day,
      is_closed: !valid,
      open_time: valid ? open : null,
      close_time: valid ? close : null,
      break_start: validBreak ? bs : null,
      break_end: validBreak ? be : null,
    };
  });
  const { error } = await supabase.from("opening_hours").upsert(rows, { onConflict: "business_id,day_of_week" });
  if (error) await logEvent("pro.updateHours", error.message);
  revalidatePath("/pro/horaires");
}

const timeOffSchema = z
  .object({
    staff_id: z.uuid().optional().or(z.literal("")),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    reason: z.string().trim().max(120).optional().default(""),
  })
  .refine((v) => `${v.end_date}${v.end_time || "24:00"}` > `${v.start_date}${v.start_time || "00:00"}`);

export async function addTimeOff(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const parsed = timeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const v = parsed.data;
  const start = zonedTimeToUtc(v.start_date, v.start_time || "00:00");
  const end = v.end_time ? zonedTimeToUtc(v.end_date, v.end_time) : new Date(zonedTimeToUtc(v.end_date, "00:00").getTime() + 86_400_000);
  const { error } = await supabase.from("time_off").insert({
    business_id: business.id,
    staff_id: v.staff_id || null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    reason: v.reason || null,
  });
  if (error) await logEvent("pro.addTimeOff", error.message);
  revalidatePath("/pro/horaires");
}

export async function deleteTimeOff(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  await supabase.from("time_off").delete().eq("id", z.uuid().parse(formData.get("id"))).eq("business_id", business.id);
  revalidatePath("/pro/horaires");
}

// ---------------------------------------------------------------------------
// Ma page : vitrine, coordonnées, zone, règles de réservation
// ---------------------------------------------------------------------------
const pageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(140).optional().default(""),
  description: z.string().trim().max(3000).optional().default(""),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(30).optional().default(""),
  website: z.union([z.url().max(200), z.literal("")]).optional().default(""),
  cover_url: z.union([z.url().max(500), z.literal("")]).optional().default(""),
  address: z.string().trim().min(5).max(200),
});

export async function updatePage(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const input = pageSchema.parse(Object.fromEntries(formData));
  const modes = modesFrom(formData);
  const patch: Record<string, unknown> = {
    name: input.name,
    tagline: input.tagline || null,
    description: input.description || null,
    email: input.email,
    phone: input.phone || null,
    website: input.website || null,
    cover_url: input.cover_url || null,
    highlights: lines(formData.get("highlights"), 8),
    payment_methods: lines(formData.get("payment_methods"), 8),
    modes: modes.length ? modes : business.modes,
    published: checkbox(formData, "published"),
  };
  if (input.address !== business.address) {
    const geo = await geocodeAddress(input.address);
    if (geo) Object.assign(patch, { address: geo.label, city: geo.city ?? business.city, city_slug: slugify(geo.city ?? business.city ?? ""), lat: geo.lat, lng: geo.lng });
  }
  const { error } = await supabase.from("businesses").update(patch).eq("id", business.id);
  if (error) await logEvent("pro.updatePage", error.message);
  revalidatePath("/pro/ma-page");
}

const rulesSchema = z
  .object({
    slot_step_minutes: z.coerce.number().refine((v) => [10, 15, 20, 30, 45, 60].includes(v)),
    min_lead_minutes: num(0, 20160),
    max_days_ahead: num(1, 365),
    cancellation_hours: num(0, 336),
    free_radius_km: num(0, 300),
    max_radius_km: num(0, 300),
    price_per_extra_km: num(0, 50),
    travel_buffer_minutes: num(0, 240),
    rebooking_days: num(7, 730),
  })
  .refine((v) => v.max_radius_km >= v.free_radius_km);

export async function updateRules(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const v = rulesSchema.parse(Object.fromEntries(formData));
  const { error } = await supabase
    .from("businesses")
    .update({
      slot_step_minutes: v.slot_step_minutes,
      min_lead_minutes: Math.round(v.min_lead_minutes),
      max_days_ahead: Math.round(v.max_days_ahead),
      cancellation_hours: Math.round(v.cancellation_hours),
      free_radius_km: v.free_radius_km,
      max_radius_km: v.max_radius_km,
      price_per_extra_km: v.price_per_extra_km,
      travel_buffer_minutes: Math.round(v.travel_buffer_minutes),
      rebooking_days: Math.round(v.rebooking_days),
    })
    .eq("id", business.id);
  if (error) await logEvent("pro.updateRules", error.message);
  revalidatePath("/pro/ma-page");
}

// ---------------------------------------------------------------------------
// Avis & acomptes
// ---------------------------------------------------------------------------
export async function replyReview(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const id = z.uuid().parse(formData.get("id"));
  const reply = z.string().trim().max(1500).parse(formData.get("reply") ?? "");
  await supabase.from("reviews").update({ reply: reply || null }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/pro/avis");
}

export async function updateDepositSettings(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();
  const percent = num(5, 100).parse(formData.get("deposit_percent"));
  const enabled = checkbox(formData, "deposit_enabled") && business.stripe_connect_onboarded;
  const { error } = await supabase.from("businesses").update({ deposit_enabled: enabled, deposit_percent: Math.round(percent) }).eq("id", business.id);
  if (error) await logEvent("pro.updateDepositSettings", error.message);
  revalidatePath("/pro/abonnement");
}
