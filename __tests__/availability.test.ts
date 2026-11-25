import { describe, expect, it } from "vitest";
import { computeAvailableSlots, isBlocking, isSlotAvailable, type OpeningHours } from "@/lib/domain/availability";
import { dayOfWeek, zonedTimeToUtc } from "@/lib/domain/time";

const weekday: OpeningHours[] = [1, 2, 3, 4, 5].map((d) => ({
  day_of_week: d,
  open_time: "09:00",
  close_time: "18:00",
  break_start: "12:00",
  break_end: "14:00",
  is_closed: false,
}));
const hours: OpeningHours[] = [
  ...weekday,
  { day_of_week: 0, open_time: null, close_time: null, break_start: null, break_end: null, is_closed: true },
];

// Mardi 1er décembre 2026 (heure d'hiver, UTC+1)
const DATE = "2026-12-01";
const NOW = new Date("2026-11-25T10:00:00Z");

describe("fuseau Europe/Paris", () => {
  it("convertit l'heure locale en UTC (hiver / été)", () => {
    expect(zonedTimeToUtc("2026-12-01", "09:00").toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
  it("gère le passage à l'heure d'été (29 mars 2026)", () => {
    expect(zonedTimeToUtc("2026-03-29", "10:00").toISOString()).toBe("2026-03-29T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-28", "10:00").toISOString()).toBe("2026-03-28T09:00:00.000Z");
  });
  it("jour de semaine 0 = dimanche", () => {
    expect(dayOfWeek("2026-11-29")).toBe(0);
    expect(dayOfWeek(DATE)).toBe(2);
  });
});

describe("créneaux libres", () => {
  it("pas de 30 min, respect de la pause et de la fermeture", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, bookings: [], durationMinutes: 120, now: NOW });
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "14:00", "14:30", "15:00", "15:30", "16:00"]);
    expect(slots[0]?.startAt).toBe("2026-12-01T08:00:00.000Z");
    expect(slots[0]?.endAt).toBe("2026-12-01T10:00:00.000Z");
  });

  it("jour fermé ou absent : aucun créneau", () => {
    expect(computeAvailableSlots({ date: "2026-11-29", openingHours: hours, bookings: [], durationMinutes: 60, now: NOW })).toEqual([]);
    expect(computeAvailableSlots({ date: "2026-11-28", openingHours: hours, bookings: [], durationMinutes: 60, now: NOW })).toEqual([]);
  });

  it("exclut les créneaux en conflit avec un RDV existant", () => {
    const slots = computeAvailableSlots({
      date: DATE,
      openingHours: hours,
      durationMinutes: 60,
      now: NOW,
      bookings: [
        { start_at: "2026-12-01T09:00:00Z", end_at: "2026-12-01T10:30:00Z", status: "confirmed", created_at: "2026-11-20T10:00:00Z" },
      ],
    });
    const times = slots.map((s) => s.time);
    expect(times).toContain("09:00");
    expect(times).not.toContain("09:30");
    expect(times).not.toContain("11:00");
    expect(times).toContain("14:00");
  });

  it("ignore les RDV annulés et les pending_deposit expirés", () => {
    const base = { start_at: "2026-12-01T08:00:00Z", end_at: "2026-12-01T17:00:00Z" };
    const slots = computeAvailableSlots({
      date: DATE,
      openingHours: hours,
      durationMinutes: 60,
      now: NOW,
      bookings: [
        { ...base, status: "cancelled", created_at: "2026-11-20T10:00:00Z" },
        { ...base, status: "pending_deposit", created_at: "2026-11-25T09:30:00Z" },
      ],
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it("un pending_deposit récent bloque le créneau", () => {
    const slots = computeAvailableSlots({
      date: DATE,
      openingHours: hours,
      durationMinutes: 60,
      now: NOW,
      bookings: [
        { start_at: "2026-12-01T08:00:00Z", end_at: "2026-12-01T17:00:00Z", status: "pending_deposit", created_at: "2026-11-25T09:50:00Z" },
      ],
    });
    expect(slots).toEqual([]);
  });

  it("respecte le délai de prévenance", () => {
    const now = new Date("2026-12-01T08:10:00Z"); // 09:10 Paris + 90 min => 10:40
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, bookings: [], durationMinutes: 60, now, minLeadMinutes: 90 });
    expect(slots[0]?.time).toBe("11:00");
  });

  it("isSlotAvailable valide uniquement un créneau recalculé", () => {
    const input = { date: DATE, openingHours: hours, bookings: [], durationMinutes: 60, now: NOW };
    expect(isSlotAvailable(input, "2026-12-01T08:00:00.000Z")).not.toBeNull();
    expect(isSlotAvailable(input, "2026-12-01T08:15:00.000Z")).toBeNull();
    expect(isSlotAvailable(input, "2026-12-01T11:00:00.000Z")).toBeNull();
  });

  it("isBlocking", () => {
    expect(isBlocking({ start_at: "", end_at: "", status: "no_show", created_at: NOW.toISOString() }, NOW)).toBe(false);
    expect(isBlocking({ start_at: "", end_at: "", status: "scheduled", created_at: NOW.toISOString() }, NOW)).toBe(true);
  });
});
