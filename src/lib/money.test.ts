import { describe, it, expect } from "vitest";
import { euroToCents, centsToEuroString, formatEuro } from "./money";

describe("euroToCents", () => {
  it("parses comma and dot decimals to integer cents", () => {
    expect(euroToCents("12,34")).toBe(1234);
    expect(euroToCents("12.34")).toBe(1234);
    expect(euroToCents("5")).toBe(500);
    expect(euroToCents("0,09")).toBe(9);
  });
  it("returns null for invalid input", () => {
    expect(euroToCents("abc")).toBeNull();
    expect(euroToCents("")).toBeNull();
  });
});

describe("centsToEuroString", () => {
  it("formats cents as a plain editable euro string with comma", () => {
    expect(centsToEuroString(1234)).toBe("12,34");
    expect(centsToEuroString(9)).toBe("0,09");
  });
});

describe("formatEuro", () => {
  it("formats cents as a localized euro amount", () => {
    expect(formatEuro(1234)).toBe("12,34 €");
    expect(formatEuro(0)).toBe("0,00 €");
  });
});
