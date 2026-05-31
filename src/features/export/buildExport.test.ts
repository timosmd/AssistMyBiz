import { describe, it, expect } from "vitest";
import { filterReceiptsByMonth, exportFileName, buildIndexCsv, buildSummary } from "./buildExport";
import type { Receipt } from "@/lib/db/receipts";

const receipts: Receipt[] = [
  { id: 1, datum: "2026-05-31", betragCent: 1234, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: "Bäcker", dateiPfad: "2026/a.jpg", dateiTyp: "jpg" },
  { id: 2, datum: "2026-04-15", betragCent: 500, kategorieId: 2, kategorieName: "Miete", notiz: null, dateiPfad: null, dateiTyp: null },
];

describe("filterReceiptsByMonth", () => {
  it("keeps only receipts whose datum starts with the YYYY-MM prefix", () => {
    expect(filterReceiptsByMonth(receipts, "2026-05").map((r) => r.id)).toEqual([1]);
    expect(filterReceiptsByMonth(receipts, "2026-04").map((r) => r.id)).toEqual([2]);
  });
});

describe("exportFileName", () => {
  it("builds Datum_Kategorie_Betrag.<ext>, amount with hyphen decimal", () => {
    expect(exportFileName(receipts[0])).toBe("2026-05-31_Wareneinkauf_12-34.jpg");
  });
});

describe("buildIndexCsv", () => {
  it("uses ; separator, comma decimals, and a header row", () => {
    const csv = buildIndexCsv([receipts[0]]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Datum;Kategorie;Betrag;Notiz;Dateiname");
    expect(lines[1]).toBe("2026-05-31;Wareneinkauf;12,34;Bäcker;2026-05-31_Wareneinkauf_12-34.jpg");
  });
});

describe("buildSummary", () => {
  it("lists totals per category and a grand total", () => {
    const txt = buildSummary([receipts[0]], "2026-05");
    expect(txt).toMatch(/Zeitraum: 2026-05/);
    expect(txt).toMatch(/Wareneinkauf: 12,34 €/);
    expect(txt).toMatch(/Gesamt: 12,34 €/);
  });
});
