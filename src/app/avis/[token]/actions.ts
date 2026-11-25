"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadBookingByToken } from "@/lib/booking-token";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReview, publicAuthorName } from "./review-rules";

export async function submitReview(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const parsed = z
    .object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1500).optional().default("") })
    .safeParse({ rating: formData.get("rating"), comment: formData.get("comment") ?? "" });
  const found = await loadBookingByToken(token);
  if (!parsed.success || !found || !canReview(found.booking)) redirect(`/avis/${encodeURIComponent(token)}`);

  const { error } = await createAdminClient().from("reviews").insert({
    business_id: found.booking.business_id,
    booking_id: found.booking.id,
    author_user_id: found.booking.client_user_id,
    author_name: publicAuthorName(found.booking.client_name),
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });
  if (error && error.code !== "23505") await logEvent("review.insert", errorMessage(error), { booking_id: found.booking.id });
  redirect(`/avis/${encodeURIComponent(token)}?merci=1`);
}
