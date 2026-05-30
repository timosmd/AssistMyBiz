import { describe, it, expect } from "vitest";
import { filterReceipts } from "./filter";
import type { Receipt } from "@/lib/db/receipts";

const base: Receipt = {
  id: 1, datum: "2026-05-31", betragCent: 1000, kategorieId: 1,
  kategorieName: "Wareneinkauf", notiz: "Bäcker Müller", dateiPfad: null, dateiTyp: null,
};
const list: Receipt[] = [
  base,
  { ...base, id: 2, kategorieId: 2, kategorieName: "Miete", notiz: "Mai" },
];

describe("filterReceipts", () => {
  it("returns all when query empty and category null", () => {
    expect(filterReceipts(list, "", null)).toHaveLength(2);
  });
  it("filters by case-insensitive text in note or category", () => {
    expect(filterReceipts(list, "bäcker", null).map((r) => r.id)).toEqual([1]);
    expect(filterReceipts(list, "miete", null).map((r) => r.id)).toEqual([2]);
  });
  it("filters by category id", () => {
    expect(filterReceipts(list, "", 2).map((r) => r.id)).toEqual([2]);
  });
});
