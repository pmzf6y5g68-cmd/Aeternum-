import type { Booking } from "@/lib/supabase/types";

/** Seul un client venu au rendez-vous peut laisser un avis (avis vérifiés). */
export function canReview(booking: Pick<Booking, "status" | "end_at">, now: Date = new Date()): boolean {
  if (booking.status === "completed") return true;
  return (booking.status === "confirmed" || booking.status === "scheduled") && new Date(booking.end_at) < now;
}

/** « Marie Dupont » → « Marie D. » */
export function publicAuthorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? "Client";
  const last = parts.length > 1 ? `${parts[parts.length - 1]?.charAt(0).toUpperCase()}.` : "";
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} ${last}`.trim();
}
