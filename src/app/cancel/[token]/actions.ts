"use server";

import { redirect } from "next/navigation";
import { cancelByClient, loadBookingByToken } from "@/lib/booking-token";

export async function cancelBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const found = await loadBookingByToken(token);
  if (found) await cancelByClient(found.booking, found.business);
  redirect(`/cancel/${encodeURIComponent(token)}`);
}
