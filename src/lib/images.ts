/** Type réel d'une image d'après ses premiers octets (on ne fait jamais confiance au type déclaré). */
export function sniffImage(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

export const IMAGE_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/** URL publique d'un fichier d'un bucket public Supabase Storage. */
export function publicStorageUrl(bucket: string, path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export const BUSINESS_PHOTO_MAX = 8;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
