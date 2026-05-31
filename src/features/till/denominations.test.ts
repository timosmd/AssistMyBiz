import { describe, it, expect } from "vitest";
import { EURO_DENOMINATIONS, totalFromCounts, difference } from "./denominations";

describe("EURO_DENOMINATIONS", () => {
  it("lists all 15 euro denominations in descending cent value", () => {
    expect(EURO_DENOMINATIONS).toHaveLength(15);
    expect(EURO_DENOMINATIONS[0]).toBe(50000);
    expect(EURO_DENOMINATIONS[EURO_DENOMINATIONS.length - 1]).toBe(1);
    const sorted = [...EURO_DENOMINATIONS].sort((a, b) => b - a);
    expect(EURO_DENOMINATIONS).toEqual(sorted);
  });
});

describe("totalFromCounts", () => {
  it("sums denomination * count in cents", () => {
    expect(totalFromCounts({ 500: 2, 100: 3 })).toBe(1300);
    expect(totalFromCounts({})).toBe(0);
  });
  it("treats missing/invalid counts as zero", () => {
    expect(totalFromCounts({ 100: NaN, 50: -3 })).toBe(0);
  });
});

describe("difference", () => {
  it("returns counted minus expected (can be negative)", () => {
    expect(difference(1000, 1230)).toBe(-230);
    expect(difference(1500, 1500)).toBe(0);
  });
});
