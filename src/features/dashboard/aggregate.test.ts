import { describe, it, expect } from "vitest";
import { revenueSeries, expensesByCategory, sumRevenue, sumExpenses } from "./aggregate";
import type { Receipt } from "@/lib/db/receipts";
import type { DailyClose } from "@/lib/db/dailyClose";

const closes: DailyClose[] = [
  { datum: "2026-05-31", gezaehltCent: 0, sollCent: 0, umsatzCent: 5000, notiz: null },
  { datum: "2026-05-30", gezaehltCent: 0, sollCent: 0, umsatzCent: null, notiz: null },
];
const receipts: Receipt[] = [
  { id: 1, datum: "2026-05-31", betragCent: 1000, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: null, dateiPfad: null, dateiTyp: null },
  { id: 2, datum: "2026-05-31", betragCent: 500, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: null, dateiPfad: null, dateiTyp: null },
  { id: 3, datum: "2026-05-31", betragCent: 2000, kategorieId: null, kategorieName: null, notiz: null, dateiPfad: null, dateiTyp: null },
];

describe("revenueSeries", () => {
  it("returns {datum, umsatzCent} sorted ascending, null umsatz as 0", () => {
    expect(revenueSeries(closes)).toEqual([
      { datum: "2026-05-30", umsatzCent: 0 },
      { datum: "2026-05-31", umsatzCent: 5000 },
    ]);
  });
});

describe("expensesByCategory", () => {
  it("sums per category, null category as 'Ohne Kategorie', sorted by sum desc", () => {
    expect(expensesByCategory(receipts)).toEqual([
      { kategorie: "Ohne Kategorie", summeCent: 2000 },
      { kategorie: "Wareneinkauf", summeCent: 1500 },
    ]);
  });
});

describe("sums", () => {
  it("sumRevenue adds umsatz (null as 0); sumExpenses adds receipt amounts", () => {
    expect(sumRevenue(closes)).toBe(5000);
    expect(sumExpenses(receipts)).toBe(3500);
  });
});
