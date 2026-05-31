import { describe, it, expect } from "vitest";
import type { Article } from "@/lib/db/articles";
import { buildReorderGroups, buildReorderText, vorschlagMenge } from "./reorderList";

function art(p: Partial<Article>): Article {
  return { id: 1, name: "X", bestand: 0, mindestbestand: 0, einheit: null, lieferant: null, ...p };
}

describe("vorschlagMenge", () => {
  it("ist die Lücke bis zum Mindestbestand, mindestens 0", () => {
    expect(vorschlagMenge(art({ bestand: 2, mindestbestand: 10 }))).toBe(8);
    expect(vorschlagMenge(art({ bestand: 10, mindestbestand: 10 }))).toBe(0);
    expect(vorschlagMenge(art({ bestand: 20, mindestbestand: 10 }))).toBe(0);
  });
});

describe("buildReorderGroups", () => {
  it("ist leer ohne Artikel", () => {
    expect(buildReorderGroups([])).toEqual([]);
  });

  it("nimmt nur Artikel auf oder unter Mindestbestand (mit gesetztem Mindest)", () => {
    const groups = buildReorderGroups([
      art({ id: 1, name: "Knapp", bestand: 1, mindestbestand: 5, lieferant: "Metro" }),
      art({ id: 2, name: "Genug", bestand: 9, mindestbestand: 5, lieferant: "Metro" }),
      art({ id: 3, name: "OhneMindest", bestand: 0, mindestbestand: 0, lieferant: "Metro" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.article.name)).toEqual(["Knapp"]);
  });

  it("gruppiert nach Lieferant mit Fallback und sortiert Gruppen + Artikel (de)", () => {
    const groups = buildReorderGroups([
      art({ id: 1, name: "Zucker", bestand: 0, mindestbestand: 3, lieferant: "Metro" }),
      art({ id: 2, name: "Apfel", bestand: 0, mindestbestand: 3, lieferant: "Metro" }),
      art({ id: 3, name: "Salz", bestand: 0, mindestbestand: 3, lieferant: null }),
      art({ id: 4, name: "Mehl", bestand: 0, mindestbestand: 3, lieferant: "Bäcker" }),
    ]);
    expect(groups.map((g) => g.lieferant)).toEqual(["Bäcker", "Metro", "Ohne Lieferant"]);
    expect(groups[1].items.map((i) => i.article.name)).toEqual(["Apfel", "Zucker"]);
  });
});

describe("buildReorderText", () => {
  it("rendert Kopf, Lieferant-Abschnitte und Zeilen", () => {
    const groups = buildReorderGroups([
      art({ id: 1, name: "Apfel", bestand: 1, mindestbestand: 5, einheit: "kg", lieferant: "Metro" }),
    ]);
    const text = buildReorderText(groups, "2026-05-31");
    expect(text).toContain("Nachbestellung — 2026-05-31");
    expect(text).toContain("== Metro ==");
    expect(text).toContain("- Apfel: 4 kg (Bestand 1 / Mindest 5)");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("meldet leeren Stand", () => {
    expect(buildReorderText([], "2026-05-31")).toContain("Keine Artikel nachzubestellen.");
  });
});
