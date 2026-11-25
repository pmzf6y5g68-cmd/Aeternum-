import "server-only";
import { z } from "zod";
import { BUSINESS_CONTACT_COLUMNS, notifyBusinessCancelledByClient, type BusinessContact } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (booking.status !== "pending_deposit") {
    try {
      await notifyBusinessCancelledByClient(booking, business);
    } catch (err) {
      await logEvent("cancel.notifyBusiness", errorMessage(err), { booking_id: booking.id }, "warning");
    }
  }
  return "cancelled";
}
