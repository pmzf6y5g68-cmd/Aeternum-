import { zonedClock } from "./opening";

/** Offres réglées par l'établissement : heures creuses (jours + plage horaire) et dernière minute. */
export interface OfferRules {
  offpeak_percent: number;
  offpeak_days: number[];
  offpeak_start: string | null;
  offpeak_end: string | null;
  lastminute_percent: number;
  lastminute_hours: number;
}

export const MAX_OFFER_PERCENT = 50;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const clamp = (p: number) => Math.max(0, Math.min(MAX_OFFER_PERCENT, Math.round(Number(p) || 0)));

/** Remise applicable à un créneau (la plus forte des deux, jamais cumulées). */
export function slotDiscountPercent(startAt: Date, now: Date, rules: OfferRules, timeZone: string): number {
  let best = 0;
  const off = clamp(rules.offpeak_percent);
  if (off > 0 && rules.offpeak_start && rules.offpeak_end) {
    const { day, minutes } = zonedClock(startAt, timeZone);
    if (rules.offpeak_days.includes(day) && minutes >= toMin(rules.offpeak_start) && minutes < toMin(rules.offpeak_end)) best = off;
  }
  const last = clamp(rules.lastminute_percent);
  if (last > 0) {
    const hoursAway = (startAt.getTime() - now.getTime()) / 3_600_000;
    if (hoursAway >= 0 && hoursAway <= Math.max(1, Math.min(72, Number(rules.lastminute_hours) || 24))) best = Math.max(best, last);
  }
  return best;
}

/** Plus forte remise proposée par l'établissement (badge « Jusqu'à −20 % »). */
export function maxOfferPercent(rules: OfferRules): number {
  const off = rules.offpeak_start && rules.offpeak_end && rules.offpeak_days.length ? clamp(rules.offpeak_percent) : 0;
  return Math.max(off, clamp(rules.lastminute_percent));
}

/** Prix remisé en centimes, arrondi à l'euro inférieur pour un prix lisible (jamais en dessous de 0). */
export function discountedCents(cents: number, percent: number): number {
  if (percent <= 0) return cents;
  const raw = Math.round((cents * (100 - Math.max(0, Math.min(100, Math.round(percent))))) / 100);
  return Math.max(0, raw >= 100 ? Math.floor(raw / 100) * 100 : raw);
}

/** Fidélité : la N-ième visite honorée (N = every) reçoit `percent` %. `completed` = visites déjà honorées. */
export function loyaltyDiscountPercent(completed: number, every: number, percent: number): number {
  if (every < 2 || percent <= 0) return 0;
  return (completed + 1) % every === 0 ? Math.min(100, Math.round(percent)) : 0;
}

/** Visites restantes avant la prochaine remise fidélité (0 = la prochaine est remisée). */
export function visitsUntilReward(completed: number, every: number): number {
  if (every < 2) return -1;
  return (every - ((completed + 1) % every)) % every;
}
