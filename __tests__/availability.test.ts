import { describe, expect, it } from "vitest";
import {
  computeAvailableSlots,
  computeSlotsForRange,
  firstAvailable,
  isBlocking,
  isSlotAvailable,
  rankStaffByLoad,
  type ExistingBooking,
  type OpeningHours,
} from "@/lib/domain/availability";
import { dayOfWeek, zonedTimeToUtc } from "@/lib/domain/time";

const hours: OpeningHours[] = [
  ...[1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "09:00", close_time: "18:00", break_start: "12:00", break_end: "14:00", is_closed: false })),
  { day_of_week: 0, open_time: null, close_time: null, break_start: null, break_end: null, is_closed: true },
];
const DATE = "2026-12-01"; // mardi, UTC+1
const NOW = new Date("2026-11-25T10:00:00Z");

function booking(start: string, end: string, extra: Partial<ExistingBooking> = {}): ExistingBooking {
  return { start_at: start, end_at: end, status: "confirmed", created_at: "2026-11-20T10:00:00Z", staff_id: null, service_id: "svc", seats: 1, ...extra };
}

describe("fuseau Europe/Paris", () => {
  it("hiver / été / changement d'heure", () => {
    expect(zonedTimeToUtc("2026-12-01", "09:00").toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-29", "10:00").toISOString()).toBe("2026-03-29T08:00:00.000Z");
    expect(dayOfWeek("2026-11-29")).toBe(0);
  });
});

describe("ressource unique", () => {
  it("pas de 30 min, pause et fermeture respectées", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, bookings: [], durationMinutes: 120, now: NOW });
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "14:00", "14:30", "15:00", "15:30", "16:00"]);
    expect(slots[0]?.staffIds).toEqual([null]);
  });
  it("pas de 15 min", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, bookings: [], durationMinutes: 30, now: NOW, stepMinutes: 15 });
    expect(slots.slice(0, 3).map((s) => s.time)).toEqual(["09:00", "09:15", "09:30"]);
  });
  it("jour fermé : rien", () => {
    expect(computeAvailableSlots({ date: "2026-11-29", openingHours: hours, bookings: [], durationMinutes: 60, now: NOW })).toEqual([]);
  });
  it("conflit avec un RDV existant", () => {
    const times = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, bookings: [booking("2026-12-01T09:00:00Z", "2026-12-01T10:30:00Z")] }).map((s) => s.time);
    expect(times).toContain("09:00");
    expect(times).not.toContain("09:30");
    expect(times).not.toContain("11:00");
  });
  it("pending_deposit récent bloque, expiré ne bloque pas", () => {
    const fresh = booking("2026-12-01T08:00:00Z", "2026-12-01T17:00:00Z", { status: "pending_deposit", created_at: "2026-11-25T09:50:00Z" });
    const stale = { ...fresh, created_at: "2026-11-25T09:30:00Z" };
    expect(computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, bookings: [fresh] })).toEqual([]);
    expect(computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, bookings: [stale] }).length).toBeGreaterThan(0);
  });
  it("délai de prévenance", () => {
    const now = new Date("2026-12-01T08:10:00Z"); // 09:10 Paris
    expect(computeAvailableSlots({ date: DATE, openingHours: hours, bookings: [], durationMinutes: 60, now, minLeadMinutes: 90 })[0]?.time).toBe("11:00");
  });
});

describe("équipe", () => {
  const staff = ["alice", "bob"];
  it("créneau libre tant qu'un membre est libre", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, staffIds: staff, bookings: [booking("2026-12-01T08:00:00Z", "2026-12-01T09:00:00Z", { staff_id: "alice" })] });
    expect(slots[0]).toMatchObject({ time: "09:00", staffIds: ["bob"] });
    expect(slots.find((s) => s.time === "10:00")?.staffIds).toEqual(["alice", "bob"]);
  });
  it("membre imposé par l'usager", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, staffIds: staff, requestedStaffId: "alice", bookings: [booking("2026-12-01T08:00:00Z", "2026-12-01T09:00:00Z", { staff_id: "alice" })] });
    expect(slots[0]?.time).toBe("10:00");
  });
  it("complet quand tous les membres sont pris", () => {
    const b = [booking("2026-12-01T08:00:00Z", "2026-12-01T09:00:00Z", { staff_id: "alice" }), booking("2026-12-01T08:00:00Z", "2026-12-01T09:00:00Z", { staff_id: "bob" })];
    expect(computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, staffIds: staff, bookings: b })[0]?.time).toBe("10:00");
  });
  it("congé d'un membre et fermeture de l'établissement", () => {
    const aliceOff = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, staffIds: staff, bookings: [], timeOff: [{ staff_id: "alice", start_at: "2026-12-01T00:00:00Z", end_at: "2026-12-02T00:00:00Z" }] });
    expect(aliceOff.every((s) => s.staffIds.length === 1 && s.staffIds[0] === "bob")).toBe(true);
    const closed = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, staffIds: staff, bookings: [], timeOff: [{ staff_id: null, start_at: "2026-12-01T12:00:00Z", end_at: "2026-12-01T18:00:00Z" }] });
    expect(closed.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
  it("répartition de charge pour « peu importe »", () => {
    const b = [booking("2026-12-01T08:00:00Z", "2026-12-01T09:00:00Z", { staff_id: "alice" })];
    expect(rankStaffByLoad(staff, b, DATE, NOW)).toEqual(["bob", "alice"]);
  });
});

describe("capacité (cours collectifs, tables)", () => {
  const groupClass = (seats: number) => booking("2026-12-01T09:00:00Z", "2026-12-01T10:00:00Z", { seats });
  it("places restantes au même horaire", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, serviceId: "svc", capacity: 10, bookings: [groupClass(7)] });
    expect(slots.find((s) => s.time === "10:00")).toMatchObject({ remaining: 3 });
  });
  it("complet si plus de places", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, serviceId: "svc", capacity: 10, seats: 4, bookings: [groupClass(7)] });
    expect(slots.find((s) => s.time === "10:00")).toBeUndefined();
  });
  it("un autre service au même moment reste un conflit", () => {
    const slots = computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, serviceId: "autre", capacity: 10, bookings: [groupClass(1)] });
    expect(slots.find((s) => s.time === "10:00")).toBeUndefined();
  });
  it("plus de places demandées que la capacité : rien", () => {
    expect(computeAvailableSlots({ date: DATE, openingHours: hours, durationMinutes: 60, now: NOW, capacity: 2, seats: 3, bookings: [] })).toEqual([]);
  });
});

describe("plage de jours", () => {
  it("premier créneau disponible sur plusieurs jours", () => {
    const days = computeSlotsForRange({ openingHours: hours, bookings: [], durationMinutes: 60, now: NOW }, "2026-11-29", 3);
    expect(days.map((d) => d.date)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(days[0]?.slots).toEqual([]);
    expect(firstAvailable(days)?.startAt).toBe("2026-11-30T08:00:00.000Z");
  });
  it("isSlotAvailable / isBlocking", () => {
    const input = { date: DATE, openingHours: hours, bookings: [], durationMinutes: 60, now: NOW };
    expect(isSlotAvailable(input, "2026-12-01T08:00:00.000Z")).not.toBeNull();
    expect(isSlotAvailable(input, "2026-12-01T08:15:00.000Z")).toBeNull();
    expect(isBlocking({ status: "no_show", created_at: NOW.toISOString() }, NOW)).toBe(false);
  });
});
