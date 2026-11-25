/**
 * Calcul pur des créneaux libres, universel :
 * - heure locale (Europe/Paris), pas configurable, pauses, délai de prévenance ;
 * - équipe : un créneau est libre si au moins un membre éligible est libre ;
 * - capacité : cours collectifs / tables avec N places au même horaire ;
 * - congés et fermetures exceptionnelles (établissement ou membre) ;
 * - pending_deposit expirés ignorés.
 */
import { DEFAULT_TZ, addDays, dayOfWeek, minutesToTime, timeToMinutes, zonedDateString, zonedTimeToUtc } from "./time";

export type BookingStatus = "pending_deposit" | "scheduled" | "confirmed" | "at_risk" | "completed" | "cancelled" | "no_show";

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
  staff_id: string | null;
  service_id: string | null;
  seats: number;
}

export interface TimeOff {
  start_at: string;
  end_at: string;
  staff_id: string | null;
}

export interface AvailabilityInput {
  /** Date calendaire locale YYYY-MM-DD. */
  date: string;
  openingHours: OpeningHours[];
  bookings: ExistingBooking[];
  timeOff?: TimeOff[];
  /** Membres éligibles pour la prestation ; tableau vide = établissement sans équipe (une seule ressource). */
  staffIds?: string[];
  /** Membre imposé par l'usager (null = peu importe). */
  requestedStaffId?: string | null;
  serviceId?: string | null;
  capacity?: number;
  seats?: number;
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
  /** Membres libres sur ce créneau (null = établissement sans équipe). */
  staffIds: (string | null)[];
  /** Places restantes (cours collectifs / tables), sinon null. */
  remaining: number | null;
}

/** Un RDV bloque-t-il encore l'agenda ? */
export function isBlocking(booking: Pick<ExistingBooking, "status" | "created_at">, now: Date, pendingTtlMinutes: number = 20): boolean {
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  if (booking.status === "pending_deposit") {
    return now.getTime() - new Date(booking.created_at).getTime() < pendingTtlMinutes * 60_000;
  }
  return true;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

interface Interval {
  start: number;
  end: number;
}

export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const step = input.stepMinutes ?? 30;
  const ttl = input.pendingTtlMinutes ?? 20;
  const lead = input.minLeadMinutes ?? 0;
  const tz = input.timeZone ?? DEFAULT_TZ;
  const duration = Math.max(1, Math.round(input.durationMinutes));
  const capacity = Math.max(1, input.capacity ?? 1);
  const seats = Math.max(1, input.seats ?? 1);
  if (seats > capacity) return [];

  const hours = input.openingHours.find((h) => h.day_of_week === dayOfWeek(input.date));
  if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return [];

  const open = timeToMinutes(hours.open_time);
  const close = timeToMinutes(hours.close_time);
  const hasBreak = Boolean(hours.break_start && hours.break_end);
  const breakStart = hasBreak ? timeToMinutes(hours.break_start as string) : 0;
  const breakEnd = hasBreak ? timeToMinutes(hours.break_end as string) : 0;

  const allStaff = input.staffIds ?? [];
  const resources: (string | null)[] = allStaff.length === 0 ? [null] : input.requestedStaffId ? allStaff.filter((s) => s === input.requestedStaffId) : allStaff;
  if (resources.length === 0) return [];

  const active = input.bookings.filter((b) => isBlocking(b, input.now, ttl));
  const bookingsBy = new Map<string | null, (ExistingBooking & Interval)[]>();
  for (const b of active) {
    const key = allStaff.length === 0 ? null : b.staff_id;
    const list = bookingsBy.get(key) ?? [];
    list.push({ ...b, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime() });
    bookingsBy.set(key, list);
  }
  const offs = (input.timeOff ?? []).map((t) => ({ staff: t.staff_id, start: new Date(t.start_at).getTime(), end: new Date(t.end_at).getTime() }));

  const earliest = input.now.getTime() + lead * 60_000;
  const slots: Slot[] = [];

  for (let m = open; m + duration <= close; m += step) {
    if (hasBreak && overlaps(m, m + duration, breakStart, breakEnd)) continue;
    const time = minutesToTime(m);
    const start = zonedTimeToUtc(input.date, time, tz).getTime();
    const end = start + duration * 60_000;
    if (start < earliest) continue;
    if (offs.some((o) => o.staff === null && overlaps(start, end, o.start, o.end))) continue;

    const free: (string | null)[] = [];
    let remaining: number | null = null;
    for (const r of resources) {
      if (r !== null && offs.some((o) => o.staff === r && overlaps(start, end, o.start, o.end))) continue;
      let used = 0;
      let conflict = false;
      for (const b of bookingsBy.get(r) ?? []) {
        if (!overlaps(start, end, b.start, b.end)) continue;
        if (capacity > 1 && b.service_id === input.serviceId && b.start === start) used += b.seats;
        else conflict = true;
      }
      if (conflict || used + seats > capacity) continue;
      free.push(r);
      if (capacity > 1) remaining = Math.max(remaining ?? 0, capacity - used);
    }
    if (free.length === 0) continue;
    slots.push({ time, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), staffIds: free, remaining });
  }
  return slots;
}

export interface DaySlots {
  date: string;
  slots: Slot[];
}

/** Créneaux sur plusieurs jours consécutifs (affichage « semaine » et aperçu des résultats). */
export function computeSlotsForRange(input: Omit<AvailabilityInput, "date">, startDate: string, days: number): DaySlots[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(startDate, i);
    return { date, slots: computeAvailableSlots({ ...input, date }) };
  });
}

/** Premier créneau libre (tri « disponibilité la plus proche »). */
export function firstAvailable(days: DaySlots[]): Slot | null {
  for (const d of days) if (d.slots[0]) return d.slots[0];
  return null;
}

/** Ordre de préférence des membres pour « peu importe » : le moins chargé ce jour-là d'abord. */
export function rankStaffByLoad(staffIds: string[], bookings: Pick<ExistingBooking, "staff_id" | "start_at" | "status" | "created_at">[], date: string, now: Date, tz: string = DEFAULT_TZ): string[] {
  const load = new Map(staffIds.map((s) => [s, 0]));
  for (const b of bookings) {
    if (!b.staff_id || !load.has(b.staff_id) || !isBlocking(b, now)) continue;
    if (zonedDateString(new Date(b.start_at), tz) !== date) continue;
    load.set(b.staff_id, (load.get(b.staff_id) ?? 0) + 1);
  }
  return [...staffIds].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
}

export function isSlotAvailable(input: AvailabilityInput, startAtIso: string): Slot | null {
  const target = new Date(startAtIso).getTime();
  return computeAvailableSlots(input).find((s) => new Date(s.startAt).getTime() === target) ?? null;
}
