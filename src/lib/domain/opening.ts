import type { OpeningHours } from "./availability";

export interface OpenState {
  open: boolean;
  /** « Ouvert jusqu'à 19h00 », « Ouvre à 14h00 », « Fermé aujourd'hui »… */
  label: string;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

/** Heure et jour de la semaine locaux (fuseau de l'établissement). */
export function zonedClock(now: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Ouvert maintenant ? Gère la pause de midi et les jours fermés. */
export function openState(hours: OpeningHours[], now: Date, timeZone: string): OpenState {
  const { day, minutes } = zonedClock(now, timeZone);
  const h = hours.find((x) => x.day_of_week === day);
  if (!h || h.is_closed || !h.open_time || !h.close_time) return { open: false, label: "Fermé aujourd'hui" };
  const ranges: [number, number][] =
    h.break_start && h.break_end
      ? [
          [toMin(h.open_time), toMin(h.break_start)],
          [toMin(h.break_end), toMin(h.close_time)],
        ]
      : [[toMin(h.open_time), toMin(h.close_time)]];
  for (const [a, b] of ranges) if (minutes >= a && minutes < b) return { open: true, label: `Ouvert jusqu'à ${fmt(b)}` };
  const next = ranges.find(([a]) => a > minutes);
  return next ? { open: false, label: `Ouvre à ${fmt(next[0])}` } : { open: false, label: "Fermé pour aujourd'hui" };
}
