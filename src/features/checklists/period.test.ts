import { describe, it, expect } from "vitest";
import { currentPeriod, runProgress } from "./period";

describe("currentPeriod", () => {
  it("returns the ISO date for daily", () => {
    expect(currentPeriod("taeglich", new Date(2026, 4, 31))).toBe("2026-05-31");
    expect(currentPeriod("taeglich", new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("returns the ISO week for weekly", () => {
    expect(currentPeriod("woechentlich", new Date(2026, 0, 1))).toBe("2026-W01"); // Do
    expect(currentPeriod("woechentlich", new Date(2026, 0, 5))).toBe("2026-W02"); // Mo
    expect(currentPeriod("woechentlich", new Date(2025, 11, 29))).toBe("2026-W01"); // Jahreswechsel
  });
});

describe("runProgress", () => {
  it("counts done vs total over the snapshot items", () => {
    const items = [{ id: "a", label: "x" }, { id: "b", label: "y" }, { id: "c", label: "z" }];
    expect(runProgress({ a: true, b: false }, items)).toEqual({ done: 1, total: 3 });
    expect(runProgress({}, items)).toEqual({ done: 0, total: 3 });
  });
});
