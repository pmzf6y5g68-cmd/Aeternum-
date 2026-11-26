/** +33 6 12 34 56 78 / 06 12 34 56 78 → +33612345678 (format E.164 demandé par Google). */
export function e164(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `+33${digits.slice(1)}`;
  return null;
}
