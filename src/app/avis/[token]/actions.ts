"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadBookingByToken } from "@/lib/booking-token";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { REVIEW_PHOTO_MAX, REVIEW_PHOTO_MAX_BYTES } from "@/lib/review-photos";
import { canReview, publicAuthorName } from "./review-rules";

/** Type réel d'après les premiers octets (on ne fait jamais confiance au type déclaré). */
function sniffImage(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function submitReview(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const parsed = z
    .object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1500).optional().default("") })
    .safeParse({ rating: formData.get("rating"), comment: formData.get("comment") ?? "" });
  const found = await loadBookingByToken(token);
  if (!parsed.success || !found || !canReview(found.booking)) redirect(`/avis/${encodeURIComponent(token)}`);

  const admin = createAdminClient();
  const photos: string[] = [];
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, REVIEW_PHOTO_MAX);
  for (const file of files) {
    if (file.size > REVIEW_PHOTO_MAX_BYTES) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = sniffImage(bytes);
    if (!ext) continue;
    const path = `${found.booking.business_id}/${found.booking.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from("review-photos").upload(path, bytes, { contentType: MIME[ext], upsert: false });
    if (upErr) await logEvent("review.photo", errorMessage(upErr), { booking_id: found.booking.id }, "warning");
    else photos.push(path);
  }
  const { error } = await admin.from("reviews").insert({
    business_id: found.booking.business_id,
    booking_id: found.booking.id,
    author_user_id: found.booking.client_user_id,
    author_name: publicAuthorName(found.booking.client_name),
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
    photos,
  });
  if (error && error.code !== "23505") await logEvent("review.insert", errorMessage(error), { booking_id: found.booking.id });
  redirect(`/avis/${encodeURIComponent(token)}?merci=1`);
}
