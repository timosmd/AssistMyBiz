import { describe, it, expect } from "vitest";
import { isLowStock, filterArticles } from "./articleFilter";
import type { Article } from "@/lib/db/articles";

const base: Article = { id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" };
const list: Article[] = [
  base,
  { id: 2, name: "Zucker", bestand: 2, mindestbestand: 4, einheit: "kg", lieferant: "Hofer" },
];

describe("isLowStock", () => {
  it("is true when bestand <= mindestbestand", () => {
    expect(isLowStock(base)).toBe(false);
    expect(isLowStock({ ...base, bestand: 3 })).toBe(true);
    expect(isLowStock({ ...base, bestand: 1 })).toBe(true);
  });
});

describe("filterArticles", () => {
  it("returns all when query empty", () => {
    expect(filterArticles(list, "")).toHaveLength(2);
  });
  it("matches name or supplier, case-insensitive", () => {
    expect(filterArticles(list, "zucker").map((a) => a.id)).toEqual([2]);
    expect(filterArticles(list, "müller").map((a) => a.id)).toEqual([1]);
  });
});
