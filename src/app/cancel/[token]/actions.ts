"use server";

import { redirect } from "next/navigation";
import { loadBookingByToken } from "@/lib/booking-token";
import { notifyStudioCancelledByClient } from "@/lib/email/booking-emails";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

export async function cancelBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const found = await loadBookingByToken(token);
  if (!found) redirect(`/cancel/${encodeURIComponent(token)}`);
  const { booking, studio } = found;

  const cancellable = ["pending_deposit", "scheduled", "confirmed", "at_risk"].includes(booking.status) && new Date(booking.start_at) > new Date();
  if (cancellable) {
    const { error } = await createAdminClient()
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .in("status", ["pending_deposit", "scheduled", "confirmed", "at_risk"]);
    if (!error && booking.status !== "pending_deposit") {
      try {
        await notifyStudioCancelledByClient(booking, studio);
      } catch (err) {
        await logEvent("cancel.notifyStudio", errorMessage(err), { booking_id: booking.id }, "warning");
      }
    }
  }
  redirect(`/cancel/${encodeURIComponent(token)}?done=1`);
}
