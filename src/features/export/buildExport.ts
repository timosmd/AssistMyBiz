import type { Receipt } from "@/lib/db/receipts";
import { centsToEuroString, formatEuro } from "@/lib/money";
import { expensesByCategory, sumExpenses } from "@/features/dashboard/aggregate";

export function filterReceiptsByMonth(receipts: Receipt[], yyyymm: string): Receipt[] {
  return receipts.filter((r) => r.datum.startsWith(yyyymm));
}

function sanitize(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "-").trim();
}

/** Dateiname für die Beleg-Kopie: "Datum_Kategorie_Betrag.<ext>" (Betrag mit Bindestrich). */
export function exportFileName(r: Receipt): string {
  const kat = sanitize(r.kategorieName ?? "Ohne-Kategorie");
  const betrag = centsToEuroString(r.betragCent).replace(",", "-");
  const ext = r.dateiTyp ?? "dat";
  return `${r.datum}_${kat}_${betrag}.${ext}`;
}

/** index.csv: ; als Trennzeichen, Dezimalkomma. */
export function buildIndexCsv(receipts: Receipt[]): string {
  const header = "Datum;Kategorie;Betrag;Notiz;Dateiname";
  const rows = receipts.map((r) => {
    const kategorie = r.kategorieName ?? "Ohne Kategorie";
    const betrag = centsToEuroString(r.betragCent);
    const notiz = (r.notiz ?? "").replace(/[;\n]/g, " ");
    const datei = r.dateiPfad ? exportFileName(r) : "";
    return `${r.datum};${kategorie};${betrag};${notiz};${datei}`;
  });
  return [header, ...rows].join("\n");
}

/** Zusammenfassung als Klartext: Summen je Kategorie + Gesamt. */
export function buildSummary(receipts: Receipt[], yyyymm: string): string {
  const lines = [`Zeitraum: ${yyyymm}`, "", "Ausgaben je Kategorie:"];
  for (const c of expensesByCategory(receipts)) {
    lines.push(`  ${c.kategorie}: ${formatEuro(c.summeCent)}`);
  }
  lines.push("", `Gesamt: ${formatEuro(sumExpenses(receipts))}`);
  return lines.join("\n");
}
