# Tageskasse 2b — Stückelungs-Zähler + Tagesabschluss — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den „Tageskasse"-Tab unter `/till` nutzbar machen: ein Euro-Stückelungs-Zähler liefert die Live-Ist-Summe, dazu Soll/Umsatz mit Differenz-Anzeige und ein pro Datum gespeicherter Tagesabschluss (SQLite).

**Architecture:** Reine Geld-/Stückelungs-Logik (Cent-Mathematik) getrennt von UI. Datenzugriff über ein neues `src/lib/db/dailyClose.ts` auf der geteilten `connection.ts`-Verbindung; Migration v3 legt `daily_close` an. UI in kleinen Einheiten (`CashCounter`, `DailyCloseView`) ersetzt den Tageskasse-Platzhalter im bestehenden `TillModule`.

**Tech Stack:** Tauri 2 (`tauri-plugin-sql`/SQLite, Migration v3), React 19 + TypeScript, Tailwind, Vitest + Testing Library. Wiederverwendet `@/lib/money` (`euroToCents`/`formatEuro`).

---

## File Structure

```
src-tauri/src/lib.rs                      # Migration v3 (daily_close) ergänzen
src/lib/db/dailyClose.ts                  # getDailyClose / saveDailyClose (+ Test)
src/lib/db/dailyClose.test.ts
src/features/till/denominations.ts        # EURO_DENOMINATIONS + reine Helfer (+ Test)
src/features/till/denominations.test.ts
src/features/till/CashCounter.tsx         # Stückelungs-Raster -> Live-Ist (+ Test)
src/features/till/CashCounter.test.tsx
src/features/till/DailyCloseView.tsx      # Datum + Zähler + Soll/Umsatz + Differenz + Speichern (+ Test)
src/features/till/DailyCloseView.test.tsx
src/routes/till/TillModule.tsx            # Tageskasse-Tab -> <DailyCloseView/>
```

---

## Task 1: Migration v3 — daily_close

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Migration v3 ergänzen**

In `src-tauri/src/lib.rs` den `migrations`-Vektor um eine dritte Migration erweitern (v1 + v2 unverändert lassen):
```rust
    Migration {
        version: 3,
        description: "create_daily_close",
        sql: "
            CREATE TABLE daily_close (
              id INTEGER PRIMARY KEY,
              datum TEXT NOT NULL UNIQUE,
              gezaehlt_cent INTEGER,
              soll_cent INTEGER,
              umsatz_cent INTEGER,
              notiz TEXT,
              erstellt_am TEXT NOT NULL
            );
        ",
        kind: MigrationKind::Up,
    },
```
(Als nächsten Eintrag in den bestehenden `vec![ ... ]` einfügen.)

- [ ] **Step 2: Rust baut**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: `Finished` ohne Fehler. NICHT `npm run tauri dev`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(till): migration v3 (daily_close table)"
```

---

## Task 2: Stückelungs-Logik (rein) — TDD

**Files:**
- Create: `src/features/till/denominations.ts`
- Test: `src/features/till/denominations.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/till/denominations.test.ts`:
```ts
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
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- denominations`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/till/denominations.ts`:
```ts
/** Euro-Stückelungen in Cent, absteigend (500 € … 1 ct). */
export const EURO_DENOMINATIONS: number[] = [
  50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
];

/** Summe in Cent aus {Stückelung(Cent): Anzahl}. Ungültige/negative Anzahlen zählen 0. */
export function totalFromCounts(counts: Record<number, number>): number {
  let sum = 0;
  for (const denom of EURO_DENOMINATIONS) {
    const n = counts[denom];
    if (Number.isFinite(n) && n > 0) sum += denom * Math.floor(n);
  }
  return sum;
}

/** Gezählt minus Soll (Kassendifferenz, kann negativ sein). */
export function difference(gezaehltCent: number, sollCent: number): number {
  return gezaehltCent - sollCent;
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- denominations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/till/denominations.ts src/features/till/denominations.test.ts
git commit -m "feat(till): pure denomination + difference helpers"
```

---

## Task 3: daily_close-Datenzugriff — TDD

**Files:**
- Create: `src/lib/db/dailyClose.ts`
- Test: `src/lib/db/dailyClose.test.ts`

- [ ] **Step 1: Failing Test (SQL gemockt)**

Create `src/lib/db/dailyClose.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { getDailyClose, saveDailyClose } from "./dailyClose";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("getDailyClose", () => {
  it("returns null when there is no row for the date", async () => {
    select.mockResolvedValue([]);
    expect(await getDailyClose("2026-05-31")).toBeNull();
  });
  it("maps the row to camelCase", async () => {
    select.mockResolvedValue([
      { datum: "2026-05-31", gezaehlt_cent: 1000, soll_cent: 1230, umsatz_cent: 5000, notiz: "ok" },
    ]);
    expect(await getDailyClose("2026-05-31")).toEqual({
      datum: "2026-05-31", gezaehltCent: 1000, sollCent: 1230, umsatzCent: 5000, notiz: "ok",
    });
  });
});

describe("saveDailyClose", () => {
  it("upserts by datum", async () => {
    execute.mockResolvedValue(undefined);
    await saveDailyClose({
      datum: "2026-05-31", gezaehltCent: 1000, sollCent: 1230, umsatzCent: 5000, notiz: "ok",
    });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO daily_close/i);
    expect(sql).toMatch(/ON CONFLICT\(datum\) DO UPDATE/i);
    expect(params.slice(0, 5)).toEqual(["2026-05-31", 1000, 1230, 5000, "ok"]);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- dailyClose`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/db/dailyClose.ts`:
```ts
import { getDb } from "./connection";

export interface DailyClose {
  datum: string;
  gezaehltCent: number | null;
  sollCent: number | null;
  umsatzCent: number | null;
  notiz: string | null;
}

interface DailyCloseRow {
  datum: string;
  gezaehlt_cent: number | null;
  soll_cent: number | null;
  umsatz_cent: number | null;
  notiz: string | null;
}

export async function getDailyClose(datum: string): Promise<DailyClose | null> {
  const db = await getDb();
  const rows = await db.select<DailyCloseRow[]>(
    "SELECT datum, gezaehlt_cent, soll_cent, umsatz_cent, notiz FROM daily_close WHERE datum = $1",
    [datum],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    datum: r.datum,
    gezaehltCent: r.gezaehlt_cent,
    sollCent: r.soll_cent,
    umsatzCent: r.umsatz_cent,
    notiz: r.notiz,
  };
}

export async function saveDailyClose(c: DailyClose): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO daily_close (datum, gezaehlt_cent, soll_cent, umsatz_cent, notiz, erstellt_am)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(datum) DO UPDATE SET
       gezaehlt_cent = excluded.gezaehlt_cent,
       soll_cent = excluded.soll_cent,
       umsatz_cent = excluded.umsatz_cent,
       notiz = excluded.notiz`,
    [c.datum, c.gezaehltCent, c.sollCent, c.umsatzCent, c.notiz, new Date().toISOString()],
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- dailyClose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/dailyClose.ts src/lib/db/dailyClose.test.ts
git commit -m "feat(till): daily_close data access (get/upsert)"
```

---

## Task 4: CashCounter — TDD

**Files:**
- Create: `src/features/till/CashCounter.tsx`
- Test: `src/features/till/CashCounter.test.tsx`

- [ ] **Step 1: Failing Test**

Create `src/features/till/CashCounter.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashCounter } from "./CashCounter";

describe("CashCounter", () => {
  it("reports the live total when a denomination count changes", async () => {
    const onTotal = vi.fn();
    render(<CashCounter onTotal={onTotal} />);
    // 2 × 5,00 € = 10,00 € (Stückelung 500 ct)
    await userEvent.type(screen.getByLabelText(/anzahl 5,00 €/i), "2");
    expect(onTotal).toHaveBeenLastCalledWith(1000);
    // Summe gezielt prüfen (nicht das gleichnamige 10-€-Stückelungslabel).
    const totalRow = screen.getByText(/gezählt \(ist\)/i).closest("div");
    expect(totalRow).toHaveTextContent(/10,00 €/);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- CashCounter`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/till/CashCounter.tsx`:
```tsx
import { useState } from "react";
import { EURO_DENOMINATIONS, totalFromCounts } from "./denominations";
import { formatEuro } from "@/lib/money";

export function CashCounter({ onTotal }: { onTotal: (cents: number) => void }) {
  const [counts, setCounts] = useState<Record<number, number>>({});

  function setCount(denom: number, raw: string) {
    const n = raw === "" ? 0 : Number(raw);
    const next = { ...counts, [denom]: n };
    setCounts(next);
    onTotal(totalFromCounts(next));
  }

  const total = totalFromCounts(counts);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {EURO_DENOMINATIONS.map((d) => (
          <label key={d} className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{formatEuro(d)}</span>
            <input aria-label={`Anzahl ${formatEuro(d)}`} type="number" min={0}
              value={counts[d] ?? ""} onChange={(e) => setCount(d, e.target.value)}
              className="w-20 rounded-lg border border-border px-2 py-1 text-right" />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-medium">Gezählt (Ist)</span>
        <span className="text-lg font-bold">{formatEuro(total)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- CashCounter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/till/CashCounter.tsx src/features/till/CashCounter.test.tsx
git commit -m "feat(till): denomination cash counter with live total"
```

---

## Task 5: DailyCloseView — TDD

**Files:**
- Create: `src/features/till/DailyCloseView.tsx`
- Test: `src/features/till/DailyCloseView.test.tsx`

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/features/till/DailyCloseView.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const saveDailyClose = vi.fn();
vi.mock("@/lib/db/dailyClose", () => ({
  getDailyClose: vi.fn(async () => null),
  saveDailyClose: (...a: unknown[]) => saveDailyClose(...a),
}));

import { DailyCloseView } from "./DailyCloseView";

beforeEach(() => saveDailyClose.mockReset());

describe("DailyCloseView", () => {
  it("shows the difference of counted minus expected and saves cents", async () => {
    saveDailyClose.mockResolvedValue(undefined);
    render(<DailyCloseView />);
    // zähle 5 × 1,00 € = 5,00 € (Stückelung 100 ct)
    await userEvent.type(await screen.findByLabelText(/anzahl 1,00 €/i), "5");
    await userEvent.type(screen.getByLabelText(/soll/i), "12,30");
    // Differenz 5,00 − 12,30 = −7,30 € (Minuszeichen tolerant: Bindestrich oder U+2212)
    expect(screen.getByText(/[-−]7,30 €/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /tagesabschluss speichern/i }));
    expect(saveDailyClose).toHaveBeenCalledTimes(1);
    const arg = saveDailyClose.mock.calls[0][0];
    expect(arg.gezaehltCent).toBe(500);
    expect(arg.sollCent).toBe(1230);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- DailyCloseView`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/till/DailyCloseView.tsx`:
```tsx
import { useEffect, useState } from "react";
import { CashCounter } from "./CashCounter";
import { difference } from "./denominations";
import { getDailyClose, saveDailyClose } from "@/lib/db/dailyClose";
import { euroToCents, formatEuro } from "@/lib/money";

export function DailyCloseView() {
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [gezaehltCent, setGezaehltCent] = useState(0);
  const [soll, setSoll] = useState("");
  const [umsatz, setUmsatz] = useState("");
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);

  useEffect(() => {
    let active = true;
    getDailyClose(datum)
      .then((c) => {
        if (!active || !c) return;
        setSoll(c.sollCent !== null ? (c.sollCent / 100).toFixed(2).replace(".", ",") : "");
        setUmsatz(c.umsatzCent !== null ? (c.umsatzCent / 100).toFixed(2).replace(".", ",") : "");
        setNotiz(c.notiz ?? "");
      })
      .catch(() => {/* Laden optional */});
    return () => { active = false; };
  }, [datum]);

  const sollCent = euroToCents(soll) ?? 0;
  const diff = difference(gezaehltCent, sollCent);

  async function save() {
    setFehler(null);
    try {
      await saveDailyClose({
        datum,
        gezaehltCent,
        sollCent: euroToCents(soll),
        umsatzCent: euroToCents(umsatz),
        notiz: notiz.trim() || null,
      });
      setGespeichert(true);
    } catch {
      setFehler("Tagesabschluss konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Datum</span>
          <input aria-label="Datum" type="date" value={datum}
            onChange={(e) => { setDatum(e.target.value); setGespeichert(false); }}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>

      <CashCounter onTotal={setGezaehltCent} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Soll (€)</span>
          <input aria-label="Soll" value={soll} onChange={(e) => setSoll(e.target.value)}
            inputMode="decimal" placeholder="0,00" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tagesumsatz (€)</span>
          <input aria-label="Tagesumsatz" value={umsatz} onChange={(e) => setUmsatz(e.target.value)}
            inputMode="decimal" placeholder="0,00" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">Notiz</span>
          <input aria-label="Notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <span className="font-medium">Kassendifferenz (Ist − Soll)</span>
        <span className="text-lg font-bold">{formatEuro(diff)}</span>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {gespeichert && <p className="text-sm text-emerald-700">Tagesabschluss gespeichert.</p>}

      <button type="button" onClick={save}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Tagesabschluss speichern
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- DailyCloseView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/till/DailyCloseView.tsx src/features/till/DailyCloseView.test.tsx
git commit -m "feat(till): daily close view (counter + soll/umsatz + difference + save)"
```

---

## Task 6: In den Tageskasse-Tab einhängen — TDD

**Files:**
- Modify: `src/routes/till/TillModule.tsx`
- Test: `src/routes/till/TillModule.test.tsx` (bestehenden Tageskasse-Test anpassen)

- [ ] **Step 1: Bestehenden Tab-Test anpassen**

In `src/routes/till/TillModule.test.tsx` den Test „switches to the Tageskasse tab placeholder" ersetzen. Da `DailyCloseView` die DB anspricht, oben in der Datei (vor den Imports der Komponente) die DB mocken — ergänze diese Mocks am Anfang der Testdatei:
```tsx
vi.mock("@/lib/db/dailyClose", () => ({
  getDailyClose: vi.fn(async () => null),
  saveDailyClose: vi.fn(async () => {}),
}));
```
und ersetze den Tageskasse-Test durch:
```tsx
  it("switches to the Tageskasse tab and shows the cash counter", async () => {
    render(<TillModule />);
    await userEvent.click(screen.getByRole("tab", { name: /tageskasse/i }));
    expect(await screen.findByText(/gezählt \(ist\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tagesabschluss speichern/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- TillModule`
Expected: FAIL (noch Platzhalter „bald verfügbar").

- [ ] **Step 3: Tageskasse-Tab verdrahten**

In `src/routes/till/TillModule.tsx` den Import ergänzen:
```tsx
import { DailyCloseView } from "@/features/till/DailyCloseView";
```
und den Tageskasse-Zweig ersetzen. Aus:
```tsx
      {tab === "tageskasse" && <p className="text-muted-foreground">Tageskasse — bald verfügbar.</p>}
```
wird:
```tsx
      {tab === "tageskasse" && <DailyCloseView />}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- TillModule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/till/TillModule.tsx src/routes/till/TillModule.test.tsx
git commit -m "feat(till): wire DailyCloseView into the Tageskasse tab"
```

---

## Task 7: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build**

Run: `npm test` → alle grün (denominations, dailyClose, CashCounter, DailyCloseView, TillModule + bestehende).
Run: `npm run build` → keine TS-Fehler.

- [ ] **Step 2: Rust-Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: ohne Fehler (Migration v3 kompiliert).

- [ ] **Step 3: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.4.0 -m "v0.4.0 — Tageskasse (Stückelungs-Zähler + Tagesabschluss)"
git push --follow-tags
```

---

## Definition of Done

- Im **Tageskasse**-Tab unter `/till`: ein Euro-**Stückelungs-Raster** rechnet live die **Ist-Summe**; Eingaben für **Soll** und **Tagesumsatz**; **Kassendifferenz** (Ist − Soll) wird angezeigt; **Tagesabschluss speichern** legt/aktualisiert genau einen Datensatz pro Datum; Datumswechsel lädt vorhandene Werte (Soll/Umsatz/Notiz); Speicherfehler werden sichtbar.
- Migration v3 legt `daily_close` an.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo build` sauber.
- Stand getaggt **`v0.4.0`** und gepusht.

## Bewusst NICHT in 2b-Tageskasse

- Dashboard + Steuerberater-Export (eigener Folgeplan), Handy-Scanner (Plan 2c).
- Persistenz der einzelnen Stückelungs-Anzahlen (nur die Ist-Summe wird gespeichert).
