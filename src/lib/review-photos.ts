/** URL publique d'une photo d'avis (bucket public « review-photos »). */
export function reviewPhotoUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/review-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export const REVIEW_PHOTO_MAX = 3;
export const REVIEW_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const REVIEW_PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
