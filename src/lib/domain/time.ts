/**
 * Conversions de fuseau horaire sans dépendance (Intl uniquement).
 * Toutes les heures d'ouverture sont exprimées en heure locale du studio (Europe/Paris).
 */
export const DEFAULT_TZ = "Europe/Paris";

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string = DEFAULT_TZ): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 0,
    day: out.day ?? 0,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à l'instant donné. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-03-29" + "09:30" (heure de Paris) -> Date UTC exacte, DST compris. */
export function zonedTimeToUtc(dateStr: string, time: string, timeZone: string = DEFAULT_TZ): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** Date locale (YYYY-MM-DD) dans le fuseau donné. */
export function zonedDateString(date: Date, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Heure locale "HH:MM" dans le fuseau donné. */
export function zonedTimeString(date: Date, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date calendaire YYYY-MM-DD. */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return t.toISOString().slice(0, 10);
}

/** "09:30" ou "09:30:00" -> minutes depuis minuit. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === value;
}
