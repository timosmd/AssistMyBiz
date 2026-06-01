import { describe, it, expect } from "vitest";
import { shiftHours, sumHours, auslastung } from "./hours";

describe("shiftHours", () => {
  it("rechnet Dauer in Dezimalstunden", () => {
    expect(shiftHours("08:00", "14:00")).toBe(6);
    expect(shiftHours("08:30", "12:00")).toBe(3.5);
  });
  it("gibt 0 bei ungültiger/leerer Spanne (ende <= start)", () => {
    expect(shiftHours("14:00", "08:00")).toBe(0);
    expect(shiftHours("08:00", "08:00")).toBe(0);
  });
});

describe("sumHours", () => {
  it("summiert mehrere Schichten", () => {
    expect(sumHours([{ start: "08:00", ende: "14:00" }, { start: "14:00", ende: "20:00" }])).toBe(12);
  });
  it("ist 0 ohne Schichten", () => {
    expect(sumHours([])).toBe(0);
  });
});

describe("auslastung", () => {
  it("diff < 0 = freie Stunden", () => {
    expect(auslastung(34, 38.5)).toEqual({ ist: 34, soll: 38.5, diff: -4.5 });
  });
  it("diff > 0 = Überstunden", () => {
    expect(auslastung(41, 38)).toEqual({ ist: 41, soll: 38, diff: 3 });
  });
});
