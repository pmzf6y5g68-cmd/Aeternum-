import { describe, expect, it } from "vitest";
import { openState } from "@/lib/domain/opening";

const week = [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "09:00", close_time: "19:00", break_start: "12:30", break_end: "14:00", is_closed: false }));
const tz = "Europe/Paris";

describe("openState", () => {
  it("ouvert le matin, avec heure de fermeture de la plage", () => {
    expect(openState(week, new Date("2026-11-25T09:30:00Z"), tz)).toEqual({ open: true, label: "Ouvert jusqu'à 12h30" });
  });
  it("pause de midi : annonce la réouverture", () => {
    expect(openState(week, new Date("2026-11-25T12:00:00Z"), tz)).toEqual({ open: false, label: "Ouvre à 14h00" });
  });
  it("après la fermeture", () => {
    expect(openState(week, new Date("2026-11-25T19:30:00Z"), tz).label).toBe("Fermé pour aujourd'hui");
  });
  it("jour sans horaires = fermé", () => {
    expect(openState(week, new Date("2026-11-29T10:00:00Z"), tz)).toEqual({ open: false, label: "Fermé aujourd'hui" });
  });
});
