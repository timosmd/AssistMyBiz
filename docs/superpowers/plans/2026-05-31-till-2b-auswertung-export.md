# Auswertung — Dashboard + Steuerberater-Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den „Auswertung"-Tab unter `/till` füllen: ein kleines Dashboard (Umsatz-Verlauf, Ausgaben je Kategorie, Monatssummen) und einen Monats-/Jahres-Export für den Steuerberater (Ordner mit Beleg-Kopien + `index.csv` + Zusammenfassung).

**Architecture:** Reine, getestete Aggregations- und CSV-/Dateinamen-Funktionen getrennt von UI. Diagramme mit **Recharts**. Der Export wählt per Verzeichnis-Dialog einen Zielordner und lässt einen **Rust-Command** (`export_bookkeeping`) die Beleg-Dateien kopieren und `index.csv` (UTF-8 BOM, `;` + Dezimalkomma) + `zusammenfassung.txt` schreiben.

**Tech Stack:** React 19 + TypeScript, Tailwind, **Recharts**, Tauri 2 (`@tauri-apps/plugin-dialog` Verzeichniswahl, Rust-Command), `tauri-plugin-sql`. Wiederverwendet `@/lib/money` (`formatEuro`, `centsToEuroString`), `@/lib/db/receipts`, `@/lib/db/dailyClose`.

---

## File Structure

```
src/features/dashboard/aggregate.ts        # reine Aggregation (+ Test)
src/features/dashboard/aggregate.test.ts
src/features/dashboard/Dashboard.tsx       # Diagramme + Monatssummen (+ Smoke-Test)
src/features/dashboard/Dashboard.test.tsx
src/features/export/buildExport.ts         # CSV/Zusammenfassung/Dateiname/Monatsfilter (+ Test)
src/features/export/buildExport.test.ts
src/features/export/ExportPanel.tsx        # Monat wählen + Exportieren (+ Test)
src/features/export/ExportPanel.test.tsx
src/features/till/AuswertungView.tsx       # Dashboard + ExportPanel zusammen
src/lib/db/dailyClose.ts                   # + listDailyCloses()
src/lib/db/dailyClose.test.ts              # + Test für listDailyCloses
src-tauri/src/export.rs                     # export_bookkeeping-Command (+ Rust-Tests)
src-tauri/src/lib.rs                        # Modul + Command registrieren
src/routes/till/TillModule.tsx             # Auswertung-Tab -> <AuswertungView/>
```

---

## Task 1: Recharts + listDailyCloses

**Files:**
- Modify: `src/lib/db/dailyClose.ts`, `src/lib/db/dailyClose.test.ts`
- Install: `recharts`

- [ ] **Step 1: Recharts installieren**

Run: `npm install recharts`

- [ ] **Step 2: Failing Test für listDailyCloses ergänzen**

In `src/lib/db/dailyClose.test.ts` am Ende (vor der letzten `});` der Datei NICHT — als neuen `describe`-Block) ergänzen:
```ts
describe("listDailyCloses", () => {
  it("maps all rows ordered by datum", async () => {
    select.mockResolvedValue([
      { datum: "2026-05-30", gezaehlt_cent: 100, soll_cent: 100, umsatz_cent: 4000, notiz: null },
      { datum: "2026-05-31", gezaehlt_cent: 200, soll_cent: 200, umsatz_cent: 5000, notiz: "x" },
    ]);
    const { listDailyCloses } = await import("./dailyClose");
    const list = await listDailyCloses();
    expect(list).toHaveLength(2);
    expect(list[0].datum).toBe("2026-05-30");
    expect(list[1].umsatzCent).toBe(5000);
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY datum/i);
  });
});
```

- [ ] **Step 3: Test → FAIL**

Run: `npm test -- dailyClose`
Expected: FAIL („listDailyCloses is not a function").

- [ ] **Step 4: listDailyCloses implementieren**

In `src/lib/db/dailyClose.ts` ans Ende ergänzen:
```ts
export async function listDailyCloses(): Promise<DailyClose[]> {
  const db = await getDb();
  const rows = await db.select<DailyCloseRow[]>(
    "SELECT datum, gezaehlt_cent, soll_cent, umsatz_cent, notiz FROM daily_close ORDER BY datum",
  );
  return rows.map((r) => ({
    datum: r.datum,
    gezaehltCent: r.gezaehlt_cent,
    sollCent: r.soll_cent,
    umsatzCent: r.umsatz_cent,
    notiz: r.notiz,
  }));
}
```

- [ ] **Step 5: Test → PASS**

Run: `npm test -- dailyClose`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/dailyClose.ts src/lib/db/dailyClose.test.ts package.json package-lock.json
git commit -m "feat(auswertung): add listDailyCloses + recharts dependency"
```

---

## Task 2: Aggregation (rein) — TDD

**Files:**
- Create: `src/features/dashboard/aggregate.ts`
- Test: `src/features/dashboard/aggregate.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/dashboard/aggregate.test.ts`:
```ts
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
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- dashboard/aggregate`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/dashboard/aggregate.ts`:
```ts
import type { Receipt } from "@/lib/db/receipts";
import type { DailyClose } from "@/lib/db/dailyClose";

export interface RevenuePoint { datum: string; umsatzCent: number; }
export interface CategorySum { kategorie: string; summeCent: number; }

export function revenueSeries(closes: DailyClose[]): RevenuePoint[] {
  return closes
    .map((c) => ({ datum: c.datum, umsatzCent: c.umsatzCent ?? 0 }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export function expensesByCategory(receipts: Receipt[]): CategorySum[] {
  const map = new Map<string, number>();
  for (const r of receipts) {
    const key = r.kategorieName ?? "Ohne Kategorie";
    map.set(key, (map.get(key) ?? 0) + r.betragCent);
  }
  return [...map.entries()]
    .map(([kategorie, summeCent]) => ({ kategorie, summeCent }))
    .sort((a, b) => b.summeCent - a.summeCent);
}

export function sumRevenue(closes: DailyClose[]): number {
  return closes.reduce((acc, c) => acc + (c.umsatzCent ?? 0), 0);
}

export function sumExpenses(receipts: Receipt[]): number {
  return receipts.reduce((acc, r) => acc + r.betragCent, 0);
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- dashboard/aggregate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/aggregate.ts src/features/dashboard/aggregate.test.ts
git commit -m "feat(auswertung): pure aggregation (revenue series, category sums)"
```

---

## Task 3: Export-Builder (rein) — TDD

**Files:**
- Create: `src/features/export/buildExport.ts`
- Test: `src/features/export/buildExport.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/export/buildExport.test.ts`:
```ts
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
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- buildExport`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/export/buildExport.ts`:
```ts
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
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- buildExport`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/export/buildExport.ts src/features/export/buildExport.test.ts
git commit -m "feat(auswertung): pure export builders (csv, summary, filename, month filter)"
```

---

## Task 4: Rust export_bookkeeping — TDD

**Files:**
- Create: `src-tauri/src/export.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Helfer + Rust-Test + Command schreiben**

Create `src-tauri/src/export.rs`:
```rust
use std::path::PathBuf;
use tauri::Manager;

/// Sicherer Zielname: keine Pfadtrenner, kein "..".
pub fn is_safe_dest_name(name: &str) -> bool {
    !name.is_empty() && !name.contains('/') && !name.contains('\\') && !name.contains("..")
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFile {
    pub src_relative: String,
    pub dest_name: String,
}

#[tauri::command]
pub fn export_bookkeeping(
    app: tauri::AppHandle,
    target_dir: String,
    files: Vec<ExportFile>,
    index_csv: String,
    summary: String,
) -> Result<u32, String> {
    let target = PathBuf::from(&target_dir);
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let receipts_base = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts");

    let mut copied = 0u32;
    for f in &files {
        if !is_safe_dest_name(&f.dest_name) {
            return Err(format!("Ungültiger Zielname: {}", f.dest_name));
        }
        let src = receipts_base.join(&f.src_relative);
        if src.exists() {
            std::fs::copy(&src, target.join(&f.dest_name)).map_err(|e| e.to_string())?;
            copied += 1;
        }
    }

    // index.csv mit UTF-8 BOM (Excel-freundlich)
    let csv = format!("\u{feff}{index_csv}");
    std::fs::write(target.join("index.csv"), csv).map_err(|e| e.to_string())?;
    std::fs::write(target.join("zusammenfassung.txt"), summary).map_err(|e| e.to_string())?;
    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn safe_dest_name_blocks_separators_and_traversal() {
        assert!(is_safe_dest_name("2026-05-31_Miete_5-00.jpg"));
        assert!(!is_safe_dest_name("../x.jpg"));
        assert!(!is_safe_dest_name("a/b.jpg"));
        assert!(!is_safe_dest_name(""));
    }
}
```

- [ ] **Step 2: Modul + Command in `lib.rs` registrieren**

In `src-tauri/src/lib.rs` oben ergänzen:
```rust
mod export;
```
und im `invoke_handler` ergänzen (bestehende Einträge behalten):
```rust
            export::export_bookkeeping,
```

- [ ] **Step 3: Rust-Test + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -12`
Expected: `safe_dest_name_blocks_separators_and_traversal ... ok`, Build ohne Fehler.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/export.rs src-tauri/src/lib.rs
git commit -m "feat(auswertung): rust export_bookkeeping command"
```

---

## Task 5: Dashboard — TDD (Smoke)

**Files:**
- Create: `src/features/dashboard/Dashboard.tsx`
- Test: `src/features/dashboard/Dashboard.test.tsx`

- [ ] **Step 1: Failing Test (Datenzugriff + Recharts gemockt)**

Create `src/features/dashboard/Dashboard.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => [
    { id: 1, datum: "2026-05-31", betragCent: 1500, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: null, dateiPfad: null, dateiTyp: null },
  ]),
}));
vi.mock("@/lib/db/dailyClose", () => ({
  listDailyCloses: vi.fn(async () => [
    { datum: "2026-05-31", gezaehltCent: 0, sollCent: 0, umsatzCent: 5000, notiz: null },
  ]),
}));
// Recharts in jsdom vereinfachen (keine echte Messung/SVG nötig).
vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: any }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass, BarChart: Pass, Bar: () => null,
    XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
  };
});

import { Dashboard } from "./Dashboard";

describe("Dashboard", () => {
  it("shows the revenue and expenses totals", async () => {
    render(<Dashboard />);
    expect(await screen.findByText(/Umsatz \(Summe\)/i)).toBeInTheDocument();
    expect(screen.getByText(/50,00 €/)).toBeInTheDocument(); // Umsatz
    expect(screen.getByText(/15,00 €/)).toBeInTheDocument(); // Ausgaben
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- Dashboard`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/dashboard/Dashboard.tsx`:
```tsx
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { listReceipts, type Receipt } from "@/lib/db/receipts";
import { listDailyCloses, type DailyClose } from "@/lib/db/dailyClose";
import { revenueSeries, expensesByCategory, sumRevenue, sumExpenses } from "./aggregate";
import { formatEuro } from "@/lib/money";

export function Dashboard() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [closes, setCloses] = useState<DailyClose[]>([]);

  useEffect(() => {
    listReceipts().then(setReceipts).catch(() => {/* leer lassen */});
    listDailyCloses().then(setCloses).catch(() => {/* leer lassen */});
  }, []);

  const revenue = revenueSeries(closes).map((p) => ({ ...p, umsatz: p.umsatzCent / 100 }));
  const byCat = expensesByCategory(receipts).map((c) => ({ ...c, betrag: c.summeCent / 100 }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Umsatz (Summe)</p>
          <p className="text-2xl font-bold">{formatEuro(sumRevenue(closes))}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Ausgaben (Summe)</p>
          <p className="text-2xl font-bold">{formatEuro(sumExpenses(receipts))}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Umsatz-Verlauf</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="datum" /><YAxis /><Tooltip />
            <Bar dataKey="umsatz" fill="hsl(168 60% 40%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Ausgaben je Kategorie</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byCat}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="kategorie" /><YAxis /><Tooltip />
            <Bar dataKey="betrag" fill="hsl(220 60% 50%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- Dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/Dashboard.tsx src/features/dashboard/Dashboard.test.tsx
git commit -m "feat(auswertung): dashboard with totals + recharts bars"
```

---

## Task 6: ExportPanel — TDD

**Files:**
- Create: `src/features/export/ExportPanel.tsx`
- Test: `src/features/export/ExportPanel.test.tsx`

- [ ] **Step 1: Failing Test (Dialog/Invoke/DB gemockt)**

Create `src/features/export/ExportPanel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invoke = vi.fn();
const open = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...a: unknown[]) => open(...a) }));
vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => [
    { id: 1, datum: "2026-05-31", betragCent: 1234, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: null, dateiPfad: "2026/a.jpg", dateiTyp: "jpg" },
    { id: 2, datum: "2026-04-15", betragCent: 500, kategorieId: 2, kategorieName: "Miete", notiz: null, dateiPfad: null, dateiTyp: null },
  ]),
}));

import { ExportPanel } from "./ExportPanel";

beforeEach(() => { invoke.mockReset(); open.mockReset(); });

describe("ExportPanel", () => {
  it("exports the chosen month to the picked folder", async () => {
    open.mockResolvedValue("C:/export-ziel");
    invoke.mockResolvedValue(1);
    render(<ExportPanel />);
    // type="month" zuverlässig über fireEvent.change setzen
    fireEvent.change(screen.getByLabelText(/monat/i), { target: { value: "2026-05" } });
    await userEvent.click(screen.getByRole("button", { name: /exportieren/i }));
    expect(invoke).toHaveBeenCalledTimes(1);
    const [cmd, args] = invoke.mock.calls[0] as [string, { targetDir: string; files: unknown[]; indexCsv: string }];
    expect(cmd).toBe("export_bookkeeping");
    expect(args.targetDir).toBe("C:/export-ziel");
    expect(args.files).toHaveLength(1); // nur der Mai-Beleg mit Datei
    expect(args.indexCsv).toMatch(/Wareneinkauf;12,34/);
  });

  it("does nothing if the folder dialog is cancelled", async () => {
    open.mockResolvedValue(null);
    render(<ExportPanel />);
    await userEvent.click(screen.getByRole("button", { name: /exportieren/i }));
    expect(invoke).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- ExportPanel`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/export/ExportPanel.tsx`:
```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listReceipts } from "@/lib/db/receipts";
import { filterReceiptsByMonth, exportFileName, buildIndexCsv, buildSummary } from "./buildExport";

export function ExportPanel() {
  const [monat, setMonat] = useState(() => new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function exportieren() {
    setFehler(null);
    setStatus(null);
    const ziel = await open({ directory: true });
    if (typeof ziel !== "string") return;
    try {
      const all = await listReceipts();
      const monatsBelege = filterReceiptsByMonth(all, monat);
      const files = monatsBelege
        .filter((r) => r.dateiPfad)
        .map((r) => ({ srcRelative: r.dateiPfad as string, destName: exportFileName(r) }));
      const copied = await invoke<number>("export_bookkeeping", {
        targetDir: ziel,
        files,
        indexCsv: buildIndexCsv(monatsBelege),
        summary: buildSummary(monatsBelege, monat),
      });
      setStatus(`Export fertig: ${monatsBelege.length} Belege, ${copied} Dateien kopiert.`);
    } catch {
      setFehler("Export fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h3 className="font-semibold">Export für den Steuerberater</h3>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Monat</span>
          <input aria-label="Monat" type="month" value={monat}
            onChange={(e) => setMonat(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <button type="button" onClick={exportieren}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Exportieren
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Erzeugt im gewählten Ordner: Beleg-Kopien, <code>index.csv</code> und <code>zusammenfassung.txt</code>.
      </p>
      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- ExportPanel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/export/ExportPanel.tsx src/features/export/ExportPanel.test.tsx
git commit -m "feat(auswertung): export panel (month + folder picker + rust export)"
```

---

## Task 7: AuswertungView + in den Tab einhängen — TDD

**Files:**
- Create: `src/features/till/AuswertungView.tsx`
- Modify: `src/routes/till/TillModule.tsx`, `src/routes/till/TillModule.test.tsx`

- [ ] **Step 1: AuswertungView anlegen**

Create `src/features/till/AuswertungView.tsx`:
```tsx
import { Dashboard } from "@/features/dashboard/Dashboard";
import { ExportPanel } from "@/features/export/ExportPanel";

export function AuswertungView() {
  return (
    <div className="space-y-6">
      <Dashboard />
      <ExportPanel />
    </div>
  );
}
```

- [ ] **Step 2: TillModule-Test für den Auswertung-Tab anpassen**

In `src/routes/till/TillModule.test.tsx` oben die zusätzlichen Mocks ergänzen (die `@/lib/db/dailyClose`-Mock existiert bereits — erweitere sie um `listDailyCloses`; ergänze Recharts-Mock):
```tsx
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: any }) => <div>{children}</div>;
  return { ResponsiveContainer: Pass, BarChart: Pass, Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null };
});
```
und stelle sicher, dass der `@/lib/db/dailyClose`-Mock auch `listDailyCloses: vi.fn(async () => [])` enthält und der `@/lib/db/receipts`-Mock `listReceipts: vi.fn(async () => [])`. Ergänze einen Test:
```tsx
  it("switches to the Auswertung tab and shows the dashboard + export", async () => {
    render(<TillModule />);
    await userEvent.click(screen.getByRole("tab", { name: /auswertung/i }));
    expect(await screen.findByText(/Umsatz \(Summe\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportieren/i })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Test → FAIL**

Run: `npm test -- TillModule`
Expected: FAIL (noch Platzhalter „bald verfügbar").

- [ ] **Step 4: Auswertung-Tab verdrahten**

In `src/routes/till/TillModule.tsx` den Import ergänzen:
```tsx
import { AuswertungView } from "@/features/till/AuswertungView";
```
und den Auswertung-Zweig ersetzen. Aus:
```tsx
      {tab === "auswertung" && <p className="text-muted-foreground">Auswertung — bald verfügbar.</p>}
```
wird:
```tsx
      {tab === "auswertung" && <AuswertungView />}
```

- [ ] **Step 5: Test → PASS**

Run: `npm test -- TillModule`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/till/AuswertungView.tsx src/routes/till/TillModule.tsx src/routes/till/TillModule.test.tsx
git commit -m "feat(auswertung): wire dashboard + export into the Auswertung tab"
```

---

## Task 8: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build**

Run: `npm test` → alle grün.
Run: `npm run build` → keine TS-Fehler.

- [ ] **Step 2: Rust-Test + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -8 && cargo build 2>&1 | tail -3`
Expected: export-Test grün, Build sauber.

- [ ] **Step 3: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.5.0 -m "v0.5.0 — Auswertung (Dashboard + Steuerberater-Export)"
git push --follow-tags
```

---

## Definition of Done

- **Auswertung**-Tab unter `/till`: Dashboard mit **Umsatz-/Ausgaben-Summe**, **Umsatz-Verlauf** (Balken) und **Ausgaben je Kategorie** (Balken); darunter ein **Export** (Monat wählen → Ordner wählen → Beleg-Kopien + `index.csv` + `zusammenfassung.txt`).
- CSV mit `;` + Dezimalkomma + UTF-8-BOM; Beleg-Dateien benannt `Datum_Kategorie_Betrag.<ext>`.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo test --lib` grün; `cargo build` sauber.
- Stand getaggt **`v0.5.0`** und gepusht.

## Bewusst NICHT in diesem Plan

- Jahres-Export-Auswahl-UI (der Monatsfilter deckt v1 ab; Jahr lässt sich später als zweite Option ergänzen — `filterReceiptsByMonth` mit „2026" als Präfix funktioniert bereits für ein ganzes Jahr).
- PDF-Erzeugung, Diagramm-Export. Handy-Scanner ist Plan 2c.
