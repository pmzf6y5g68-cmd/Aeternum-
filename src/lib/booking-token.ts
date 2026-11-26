import "server-only";
import { z } from "zod";
import { BUSINESS_CONTACT_COLUMNS, notifyBusinessCancelledByClient, notifyRescheduled, type BusinessContact } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWaitlistForSlot } from "@/lib/waitlist";
import type { Booking } from "@/lib/supabase/types";

export async function loadBookingByToken(token: string): Promise<{ booking: Booking; business: BusinessContact } | null> {
  if (!z.uuid().safeParse(token).success) return null;
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("confirm_token", token).maybeSingle<Booking>();
  if (!booking) return null;
  const { data: business } = await admin.from("businesses").select(BUSINESS_CONTACT_COLUMNS).eq("id", booking.business_id).single<BusinessContact>();
  return business ? { booking, business } : null;
}

const ACTIVE = ["pending_deposit", "scheduled", "confirmed", "at_risk"] as const;

export type CancelOutcome = "cancelled" | "already" | "too_late" | "past";

/** Annulation par l'usager, soumise à la politique d'annulation de l'établissement. */
export function canClientCancel(booking: Booking, business: Pick<BusinessContact, "cancellation_hours">, now: Date = new Date()): CancelOutcome | "ok" {
  if (booking.status === "cancelled") return "already";
  if (!(ACTIVE as readonly string[]).includes(booking.status) || new Date(booking.start_at) <= now) return "past";
  const limit = new Date(booking.start_at).getTime() - business.cancellation_hours * 3_600_000;
  return now.getTime() > limit && booking.status !== "pending_deposit" ? "too_late" : "ok";
}

export async function cancelByClient(booking: Booking, business: BusinessContact): Promise<CancelOutcome> {
  const check = canClientCancel(booking, business);
  if (check !== "ok") return check;
  const { data } = await createAdminClient()
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "client" })
    .eq("id", booking.id)
    .in("status", [...ACTIVE])
    .select("id");
  if (!data?.length) return "already";
  await notifyWaitlistForSlot(booking);
  if (booking.status !== "pending_deposit") {
    try {
      await notifyBusinessCancelledByClient(booking, business);
    } catch (err) {
      await logEvent("cancel.notifyBusiness", errorMessage(err), { booking_id: booking.id }, "warning");
    }
  }
  return "cancelled";
}

export const MAX_RESCHEDULES = 3;
export type RescheduleOutcome = "moved" | "slot_taken" | "too_many" | CancelOutcome;

/** Déplacer = même règle de délai que l'annulation (on ne déplace pas un RDV qu'on ne pourrait plus annuler). */
export function canClientReschedule(booking: Booking, business: Pick<BusinessContact, "cancellation_hours">, now: Date = new Date()): RescheduleOutcome | "ok" {
  if (booking.status === "pending_deposit") return "past";
  const check = canClientCancel(booking, business, now);
  if (check !== "ok") return check;
  return booking.reschedule_count >= MAX_RESCHEDULES ? "too_many" : "ok";
}

/** Déplacement atomique (verrou + revérification serveur), libère l'ancien créneau pour la liste d'attente. */
export async function rescheduleByClient(booking: Booking, business: BusinessContact, startAt: string): Promise<RescheduleOutcome> {
  const check = canClientReschedule(booking, business);
  if (check !== "ok") return check;
  const { data, error } = await createAdminClient()
    .rpc("reschedule_booking_atomic", { p_booking_id: booking.id, p_start_at: startAt, p_max_reschedules: MAX_RESCHEDULES })
    .single<Booking>();
  if (error) {
    if (error.message.includes("SLOT_TAKEN")) return "slot_taken";
    if (error.message.includes("TOO_MANY_RESCHEDULES")) return "too_many";
    if (error.message.includes("NOT_RESCHEDULABLE")) return "past";
    throw error;
  }
  await notifyWaitlistForSlot(booking);
  try {
    await notifyRescheduled(data, booking.start_at, business);
  } catch (err) {
    await logEvent("reschedule.notify", errorMessage(err), { booking_id: booking.id }, "warning");
  }
  return "moved";
}
