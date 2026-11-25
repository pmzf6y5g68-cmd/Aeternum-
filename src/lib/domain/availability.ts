/**
 * Calcul pur des créneaux libres : pas de 30 min, heure de Paris, pauses,
 * conflits avec les RDV existants, pending_deposit expirés ignorés.
 */
import { DEFAULT_TZ, dayOfWeek, minutesToTime, timeToMinutes, zonedTimeToUtc } from "./time";

export type BookingStatus =
  | "pending_deposit"
  | "scheduled"
  | "confirmed"
  | "at_risk"
  | "completed"
  | "cancelled"
  | "no_show";

export interface OpeningHours {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  is_closed: boolean;
}

export interface ExistingBooking {
  start_at: string;
  end_at: string;
  status: BookingStatus;
  created_at: string;
}

export interface AvailabilityInput {
  /** Date calendaire locale YYYY-MM-DD. */
  date: string;
  openingHours: OpeningHours[];
  bookings: ExistingBooking[];
  /** Minutes bloquées par le RDV demandé (prestation + options + tampon trajet). */
  durationMinutes: number;
  now: Date;
  stepMinutes?: number;
  pendingTtlMinutes?: number;
  minLeadMinutes?: number;
  timeZone?: string;
}

export interface Slot {
  /** Heure locale "HH:MM". */
  time: string;
  startAt: string;
  endAt: string;
}

/** Un RDV bloque-t-il encore l'agenda ? */
export function isBlocking(booking: ExistingBooking, now: Date, pendingTtlMinutes: number = 20): boolean {
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  if (booking.status === "pending_deposit") {
    const ageMs = now.getTime() - new Date(booking.created_at).getTime();
    return ageMs < pendingTtlMinutes * 60_000;
  }
  return true;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const step = input.stepMinutes ?? 30;
  const ttl = input.pendingTtlMinutes ?? 20;
  const lead = input.minLeadMinutes ?? 0;
  const tz = input.timeZone ?? DEFAULT_TZ;
  const duration = Math.max(1, Math.round(input.durationMinutes));

  const hours = input.openingHours.find((h) => h.day_of_week === dayOfWeek(input.date));
  if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return [];

  const open = timeToMinutes(hours.open_time);
  const close = timeToMinutes(hours.close_time);
  const hasBreak = Boolean(hours.break_start && hours.break_end);
  const breakStart = hasBreak ? timeToMinutes(hours.break_start as string) : 0;
  const breakEnd = hasBreak ? timeToMinutes(hours.break_end as string) : 0;

  const blocking = input.bookings
    .filter((b) => isBlocking(b, input.now, ttl))
    .map((b) => ({ start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime() }));

  const earliest = input.now.getTime() + lead * 60_000;
  const slots: Slot[] = [];

  for (let m = open; m + duration <= close; m += step) {
    if (hasBreak && overlaps(m, m + duration, breakStart, breakEnd)) continue;
    const time = minutesToTime(m);
    const start = zonedTimeToUtc(input.date, time, tz).getTime();
    const end = start + duration * 60_000;
    if (start < earliest) continue;
    if (blocking.some((b) => overlaps(start, end, b.start, b.end))) continue;
    slots.push({ time, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() });
  }
  return slots;
}

/** Vérifie qu'un horaire demandé correspond exactement à un créneau libre recalculé côté serveur. */
export function isSlotAvailable(input: AvailabilityInput, startAtIso: string): Slot | null {
  const target = new Date(startAtIso).getTime();
  return computeAvailableSlots(input).find((s) => new Date(s.startAt).getTime() === target) ?? null;
}
