# Schichten Plan 1 — Mitarbeiter, Vorlagen & Wochenplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Den nutzbaren Kern des Schichten-Moduls bauen: Mitarbeiter & Schicht-Vorlagen verwalten, einen Wochenplan per Klick-Raster bearbeiten, Stundensummen + Auslastung je Mitarbeiter anzeigen.

**Architecture:** Migration v7 legt `employees`, `shift_presets` (mit Seeds) und `shifts` an. Reine Module `week.ts`/`hours.ts` kapseln ISO-Wochen- und Stundenlogik (voll unit-getestet). Typisierte Datenschichten (`employees.ts`, `shiftPresets.ts`, `shifts.ts`) über den geteilten `getDb()`-Singleton. UI: `ShiftModule` mit Tabs Plan/Mitarbeiter/Vorlagen, ersetzt den `ShiftsPlaceholder` auf Route `/shifts`.

**Tech Stack:** Tauri 2 (Rust Migration), React 19 + TS, tauri-plugin-sql (SQLite), Vitest + Testing Library.

Verify-Befehle: `npm test`, `npm run build`; Rust: `export PATH="$HOME/.cargo/bin:$PATH"` dann `cd src-tauri && cargo build`.

---

### Task 1: Migration v7 (employees, shift_presets, shifts)

**Files:**
- Modify: `src-tauri/src/lib.rs` (Migrations-Vec, nach v6)

- [ ] **Step 1: Migration anhängen** — nach dem `version: 6`-Block, vor dem schließenden `];`:

```rust
        Migration {
            version: 7,
            description: "create_shifts_employees_presets",
            sql: "
                CREATE TABLE employees (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  wochenstunden REAL NOT NULL DEFAULT 0,
                  farbe TEXT,
                  aktiv INTEGER NOT NULL DEFAULT 1,
                  erstellt_am TEXT NOT NULL
                );
                CREATE TABLE shift_presets (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  start TEXT NOT NULL,
                  ende TEXT NOT NULL,
                  erstellt_am TEXT NOT NULL
                );
                INSERT INTO shift_presets (name, start, ende, erstellt_am) VALUES
                  ('Früh', '08:00', '14:00', '2026-06-01T00:00:00Z'),
                  ('Spät', '14:00', '20:00', '2026-06-01T00:00:00Z');
                CREATE TABLE shifts (
                  id INTEGER PRIMARY KEY,
                  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                  datum TEXT NOT NULL,
                  start TEXT NOT NULL,
                  ende TEXT NOT NULL,
                  erstellt_am TEXT NOT NULL
                );
                CREATE INDEX idx_shifts_datum ON shifts(datum);
            ",
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 2: Rust bauen**

Run: `export PATH="$HOME/.cargo/bin:$PATH" && cd src-tauri && cargo build`
Expected: kompiliert ohne Fehler.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs && git commit -m "feat(schichten): Migration v7 employees/shift_presets/shifts"
```

---

### Task 2: Reine Wochenlogik `week.ts`

**Files:**
- Create: `src/features/shifts/week.ts`
- Test: `src/features/shifts/week.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from "vitest";
import { weekDays, weekLabel, addWeeks } from "./week";

describe("weekDays", () => {
  it("liefert Mo..So der ISO-Woche als ISO-Daten", () => {
    // Mittwoch 2026-06-03 -> Woche Mo 01.06 .. So 07.06
    const days = weekDays(new Date(2026, 5, 3));
    expect(days).toEqual([
      "2026-06-01", "2026-06-02", "2026-06-03",
      "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07",
    ]);
  });
  it("behandelt Sonntag als letzten Tag derselben Woche", () => {
    const days = weekDays(new Date(2026, 5, 7)); // So
    expect(days[0]).toBe("2026-06-01");
    expect(days[6]).toBe("2026-06-07");
  });
  it("funktioniert über Monats-/Jahresgrenzen", () => {
    const days = weekDays(new Date(2026, 11, 31)); // Do 31.12.2026
    expect(days[0]).toBe("2026-12-28");
    expect(days[6]).toBe("2027-01-03");
  });
});

describe("addWeeks", () => {
  it("verschiebt um n Wochen", () => {
    expect(weekDays(addWeeks(new Date(2026, 5, 3), 1))[0]).toBe("2026-06-08");
    expect(weekDays(addWeeks(new Date(2026, 5, 3), -1))[0]).toBe("2026-05-25");
  });
});

describe("weekLabel", () => {
  it("zeigt KW-Nummer und Datumsspanne", () => {
    expect(weekLabel(new Date(2026, 5, 3))).toBe("KW 23 · 01.–07.06.2026");
  });
});
```

- [ ] **Step 2: Test laufen lassen → FAIL**

Run: `npx vitest run src/features/shifts/week.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren**

```ts
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Montag der ISO-Woche von `date` (lokale Zeit). */
function monday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIdx = (d.getDay() + 6) % 7; // Mo=0 … So=6
  d.setDate(d.getDate() - dayIdx);
  return d;
}

/** ISO-Wochennummer (1..53). */
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Donnerstag dieser Woche
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThu.getTime()) / 604800000);
}

/** Die 7 ISO-Tage (Mo…So) der Woche von `date`. */
export function weekDays(date: Date): string[] {
  const mo = monday(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mo);
    d.setDate(mo.getDate() + i);
    return isoDate(d);
  });
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n * 7);
  return d;
}

/** z.B. "KW 23 · 01.–07.06.2026". */
export function weekLabel(date: Date): string {
  const mo = monday(date);
  const so = new Date(mo);
  so.setDate(mo.getDate() + 6);
  const kw = isoWeekNumber(date);
  return `KW ${kw} · ${pad2(mo.getDate())}.–${pad2(so.getDate())}.${pad2(so.getMonth() + 1)}.${so.getFullYear()}`;
}
```

- [ ] **Step 4: Test laufen lassen → PASS**

Run: `npx vitest run src/features/shifts/week.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shifts/week.ts src/features/shifts/week.test.ts && git commit -m "feat(schichten): reine Wochenlogik week.ts"
```

---

### Task 3: Reine Stundenlogik `hours.ts`

**Files:**
- Create: `src/features/shifts/hours.ts`
- Test: `src/features/shifts/hours.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from "vitest";
import { shiftHours, sumHours, auslastung } from "./hours";

describe("shiftHours", () => {
  it("rechnet Dauer in Dezimalstunden", () => {
    expect(shiftHours("08:00", "14:00")).toBe(6);
    expect(shiftHours("08:30", "12:00")).toBe(3.5);
  });
  it("gibt 0 bei ungültiger/leerer Spanne (ende <= start)", () => {
    expect(shiftHours("14:00", "08:00")).toBe(0);
    expect(shiftHours("08:00", "08:00")).toBe(0);
  });
});

describe("sumHours", () => {
  it("summiert mehrere Schichten", () => {
    expect(sumHours([{ start: "08:00", ende: "14:00" }, { start: "14:00", ende: "20:00" }])).toBe(12);
  });
  it("ist 0 ohne Schichten", () => {
    expect(sumHours([])).toBe(0);
  });
});

describe("auslastung", () => {
  it("diff < 0 = freie Stunden", () => {
    expect(auslastung(34, 38.5)).toEqual({ ist: 34, soll: 38.5, diff: -4.5 });
  });
  it("diff > 0 = Überstunden", () => {
    expect(auslastung(41, 38)).toEqual({ ist: 41, soll: 38, diff: 3 });
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npx vitest run src/features/shifts/hours.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren**

```ts
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** Dauer in Dezimalstunden; ende <= start (oder ungültig) → 0. Kein Über-Nacht in v1. */
export function shiftHours(start: string, ende: string): number {
  const s = toMinutes(start);
  const e = toMinutes(ende);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return (e - s) / 60;
}

export function sumHours(shifts: { start: string; ende: string }[]): number {
  return shifts.reduce((acc, s) => acc + shiftHours(s.start, s.ende), 0);
}

export interface Auslastung {
  ist: number;
  soll: number;
  diff: number; // ist - soll: >0 Überstunden, <0 freie Stunden
}

export function auslastung(ist: number, soll: number): Auslastung {
  return { ist, soll, diff: Math.round((ist - soll) * 100) / 100 };
}
```

- [ ] **Step 4: Test → PASS**

Run: `npx vitest run src/features/shifts/hours.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shifts/hours.ts src/features/shifts/hours.test.ts && git commit -m "feat(schichten): reine Stundenlogik hours.ts"
```

---

### Task 4: Datenschicht `employees.ts`

**Files:**
- Create: `src/lib/db/employees.ts`
- Test: `src/lib/db/employees.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listEmployees, addEmployee, updateEmployee, setEmployeeActive, deleteEmployee } from "./employees";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

describe("listEmployees", () => {
  it("lädt nur aktive und mappt aktiv->boolean", async () => {
    select.mockResolvedValue([{ id: 1, name: "Anna", wochenstunden: 38.5, farbe: "#f00", aktiv: 1 }]);
    const list = await listEmployees();
    expect(list[0]).toEqual({ id: 1, name: "Anna", wochenstunden: 38.5, farbe: "#f00", aktiv: true });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/WHERE aktiv = 1/i);
  });
  it("lädt alle, wenn includeInactive", async () => {
    select.mockResolvedValue([]);
    await listEmployees(true);
    const [sql] = select.mock.calls[0];
    expect(sql).not.toMatch(/WHERE aktiv/i);
  });
});

describe("addEmployee", () => {
  it("fügt einen Mitarbeiter ein", async () => {
    execute.mockResolvedValue(undefined);
    await addEmployee({ name: "Bernd", wochenstunden: 20, farbe: null });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO employees/i);
    expect(params.slice(0, 3)).toEqual(["Bernd", 20, null]);
  });
});

describe("updateEmployee / setEmployeeActive / deleteEmployee", () => {
  it("update setzt Felder", async () => {
    execute.mockResolvedValue(undefined);
    await updateEmployee(5, { name: "C", wochenstunden: 10, farbe: "#0f0" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE employees SET/i);
    expect(params).toEqual(["C", 10, "#0f0", 5]);
  });
  it("setEmployeeActive setzt aktiv", async () => {
    execute.mockResolvedValue(undefined);
    await setEmployeeActive(5, false);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE employees SET aktiv/i);
    expect(params).toEqual([0, 5]);
  });
  it("delete löscht", async () => {
    execute.mockResolvedValue(undefined);
    await deleteEmployee(5);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM employees WHERE id/i);
    expect(params).toEqual([5]);
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npx vitest run src/lib/db/employees.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren**

```ts
import { getDb } from "./connection";

export interface NewEmployee {
  name: string;
  wochenstunden: number;
  farbe: string | null;
}
export interface Employee extends NewEmployee {
  id: number;
  aktiv: boolean;
}

interface EmployeeRow {
  id: number;
  name: string;
  wochenstunden: number;
  farbe: string | null;
  aktiv: number;
}

function mapRow(r: EmployeeRow): Employee {
  return { id: r.id, name: r.name, wochenstunden: r.wochenstunden, farbe: r.farbe, aktiv: r.aktiv === 1 };
}

export async function listEmployees(includeInactive = false): Promise<Employee[]> {
  const db = await getDb();
  const where = includeInactive ? "" : "WHERE aktiv = 1 ";
  const rows = await db.select<EmployeeRow[]>(
    `SELECT id, name, wochenstunden, farbe, aktiv FROM employees ${where}ORDER BY name`,
  );
  return rows.map(mapRow);
}

export async function addEmployee(e: NewEmployee): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO employees (name, wochenstunden, farbe, aktiv, erstellt_am) VALUES ($1, $2, $3, 1, $4)",
    [e.name, e.wochenstunden, e.farbe, new Date().toISOString()],
  );
}

export async function updateEmployee(id: number, e: NewEmployee): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE employees SET name = $1, wochenstunden = $2, farbe = $3 WHERE id = $4",
    [e.name, e.wochenstunden, e.farbe, id],
  );
}

export async function setEmployeeActive(id: number, aktiv: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE employees SET aktiv = $1 WHERE id = $2", [aktiv ? 1 : 0, id]);
}

export async function deleteEmployee(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM employees WHERE id = $1", [id]);
}
```

- [ ] **Step 4: Test → PASS** — Run: `npx vitest run src/lib/db/employees.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/employees.ts src/lib/db/employees.test.ts && git commit -m "feat(schichten): Datenschicht employees.ts"
```

---

### Task 5: Datenschicht `shiftPresets.ts`

**Files:**
- Create: `src/lib/db/shiftPresets.ts`
- Test: `src/lib/db/shiftPresets.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listPresets, addPreset, updatePreset, deletePreset } from "./shiftPresets";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

describe("shiftPresets", () => {
  it("listPresets lädt sortiert", async () => {
    select.mockResolvedValue([{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }]);
    const list = await listPresets();
    expect(list[0]).toEqual({ id: 1, name: "Früh", start: "08:00", ende: "14:00" });
  });
  it("addPreset fügt ein", async () => {
    execute.mockResolvedValue(undefined);
    await addPreset({ name: "Mittag", start: "11:00", ende: "15:00" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO shift_presets/i);
    expect(params.slice(0, 3)).toEqual(["Mittag", "11:00", "15:00"]);
  });
  it("updatePreset setzt Felder", async () => {
    execute.mockResolvedValue(undefined);
    await updatePreset(2, { name: "X", start: "09:00", ende: "10:00" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE shift_presets SET/i);
    expect(params).toEqual(["X", "09:00", "10:00", 2]);
  });
  it("deletePreset löscht", async () => {
    execute.mockResolvedValue(undefined);
    await deletePreset(2);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM shift_presets WHERE id/i);
    expect(params).toEqual([2]);
  });
});
```

- [ ] **Step 2: Test → FAIL** — Run: `npx vitest run src/lib/db/shiftPresets.test.ts`.

- [ ] **Step 3: Implementieren**

```ts
import { getDb } from "./connection";

export interface NewPreset {
  name: string;
  start: string;
  ende: string;
}
export interface ShiftPreset extends NewPreset {
  id: number;
}

export async function listPresets(): Promise<ShiftPreset[]> {
  const db = await getDb();
  return db.select<ShiftPreset[]>("SELECT id, name, start, ende FROM shift_presets ORDER BY start, name");
}

export async function addPreset(p: NewPreset): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO shift_presets (name, start, ende, erstellt_am) VALUES ($1, $2, $3, $4)",
    [p.name, p.start, p.ende, new Date().toISOString()],
  );
}

export async function updatePreset(id: number, p: NewPreset): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE shift_presets SET name = $1, start = $2, ende = $3 WHERE id = $4",
    [p.name, p.start, p.ende, id],
  );
}

export async function deletePreset(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shift_presets WHERE id = $1", [id]);
}
```

- [ ] **Step 4: Test → PASS** — Run: `npx vitest run src/lib/db/shiftPresets.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/shiftPresets.ts src/lib/db/shiftPresets.test.ts && git commit -m "feat(schichten): Datenschicht shiftPresets.ts"
```

---

### Task 6: Datenschicht `shifts.ts`

**Files:**
- Create: `src/lib/db/shifts.ts`
- Test: `src/lib/db/shifts.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listShiftsForWeek, upsertShift, deleteShift } from "./shifts";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

describe("listShiftsForWeek", () => {
  it("baut eine IN-Klausel mit einem Platzhalter je Tag und mappt camelCase", async () => {
    select.mockResolvedValue([
      { id: 9, employee_id: 1, datum: "2026-06-01", start: "08:00", ende: "14:00" },
    ]);
    const list = await listShiftsForWeek(["2026-06-01", "2026-06-02"]);
    expect(list[0]).toEqual({ id: 9, employeeId: 1, datum: "2026-06-01", start: "08:00", ende: "14:00" });
    const [sql, params] = select.mock.calls[0];
    expect(sql).toMatch(/datum IN \(\$1, \$2\)/i);
    expect(params).toEqual(["2026-06-01", "2026-06-02"]);
  });
  it("fragt bei leerer Woche nicht ab", async () => {
    const list = await listShiftsForWeek([]);
    expect(list).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("upsertShift", () => {
  it("löscht zuerst den Tag-Eintrag des Mitarbeiters und legt dann neu an", async () => {
    execute.mockResolvedValue(undefined);
    await upsertShift(1, "2026-06-01", "08:00", "14:00");
    const [delSql, delParams] = execute.mock.calls[0];
    expect(delSql).toMatch(/DELETE FROM shifts WHERE employee_id = \$1 AND datum = \$2/i);
    expect(delParams).toEqual([1, "2026-06-01"]);
    const [insSql, insParams] = execute.mock.calls[1];
    expect(insSql).toMatch(/INSERT INTO shifts/i);
    expect(insParams.slice(0, 4)).toEqual([1, "2026-06-01", "08:00", "14:00"]);
  });
});

describe("deleteShift", () => {
  it("löscht per id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteShift(9);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM shifts WHERE id = \$1/i);
    expect(params).toEqual([9]);
  });
});
```

- [ ] **Step 2: Test → FAIL** — Run: `npx vitest run src/lib/db/shifts.test.ts`.

- [ ] **Step 3: Implementieren**

```ts
import { getDb } from "./connection";

export interface Shift {
  id: number;
  employeeId: number;
  datum: string;
  start: string;
  ende: string;
}

interface ShiftRow {
  id: number;
  employee_id: number;
  datum: string;
  start: string;
  ende: string;
}

export async function listShiftsForWeek(isoDays: string[]): Promise<Shift[]> {
  if (isoDays.length === 0) return [];
  const db = await getDb();
  const placeholders = isoDays.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<ShiftRow[]>(
    `SELECT id, employee_id, datum, start, ende FROM shifts WHERE datum IN (${placeholders})`,
    isoDays,
  );
  return rows.map((r) => ({ id: r.id, employeeId: r.employee_id, datum: r.datum, start: r.start, ende: r.ende }));
}

/** Ersetzt den (höchstens einen) Tag-Eintrag des Mitarbeiters → "ein Eintrag pro Tag". */
export async function upsertShift(employeeId: number, datum: string, start: string, ende: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shifts WHERE employee_id = $1 AND datum = $2", [employeeId, datum]);
  await db.execute(
    "INSERT INTO shifts (employee_id, datum, start, ende, erstellt_am) VALUES ($1, $2, $3, $4, $5)",
    [employeeId, datum, start, ende, new Date().toISOString()],
  );
}

export async function deleteShift(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shifts WHERE id = $1", [id]);
}
```

- [ ] **Step 4: Test → PASS** — Run: `npx vitest run src/lib/db/shifts.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/shifts.ts src/lib/db/shifts.test.ts && git commit -m "feat(schichten): Datenschicht shifts.ts (upsert ein Eintrag/Tag)"
```

---

### Task 7: Mitarbeiter-Tab (`EmployeeForm`, `EmployeeList`, `MitarbeiterView`)

**Files:**
- Create: `src/features/shifts/EmployeeForm.tsx`
- Create: `src/features/shifts/EmployeeList.tsx`
- Create: `src/features/shifts/MitarbeiterView.tsx`
- Test: `src/features/shifts/MitarbeiterView.test.tsx`

- [ ] **Step 1: `EmployeeForm.tsx`**

```tsx
import { useState } from "react";
import { addEmployee } from "@/lib/db/employees";

export const FARBEN = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function toHours(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function EmployeeForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [soll, setSoll] = useState("");
  const [farbe, setFarbe] = useState<string>(FARBEN[3]);
  const [fehler, setFehler] = useState<string | null>(null);

  async function add() {
    if (name.trim() === "") { setFehler("Bitte einen Namen eingeben."); return; }
    setFehler(null);
    try {
      await addEmployee({ name: name.trim(), wochenstunden: toHours(soll), farbe });
    } catch {
      setFehler("Hinzufügen fehlgeschlagen."); return;
    }
    onSaved();
    setName(""); setSoll("");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Wochenstunden (Soll)</span>
          <input aria-label="Wochenstunden" inputMode="decimal" value={soll}
            onChange={(e) => setSoll(e.target.value)} placeholder="z.B. 38,5"
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Farbe</span>
        {FARBEN.map((f) => (
          <button key={f} type="button" aria-label={`Farbe ${f}`} onClick={() => setFarbe(f)}
            className={"h-6 w-6 rounded-full border-2 " + (farbe === f ? "border-foreground" : "border-transparent")}
            style={{ backgroundColor: f }} />
        ))}
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <button type="button" onClick={add}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Hinzufügen
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `EmployeeList.tsx`**

```tsx
import { useEffect, useState } from "react";
import { listEmployees, setEmployeeActive, deleteEmployee, type Employee } from "@/lib/db/employees";

export function EmployeeList({ reloadKey }: { reloadKey: number }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    try { setEmployees(await listEmployees(true)); setFehler(null); }
    catch { setFehler("Mitarbeiter konnten nicht geladen werden."); }
  }
  useEffect(() => { reload(); }, [reloadKey]);

  async function toggle(e: Employee) {
    try { await setEmployeeActive(e.id, !e.aktiv); await reload(); }
    catch { setFehler("Änderung fehlgeschlagen."); }
  }
  async function remove(id: number) {
    try { await deleteEmployee(id); await reload(); }
    catch { setFehler("Löschen fehlgeschlagen."); }
  }

  if (fehler) return <p className="text-sm text-red-600">{fehler}</p>;
  if (employees.length === 0) return <p className="text-muted-foreground">Noch keine Mitarbeiter.</p>;

  return (
    <div className="space-y-2">
      {employees.map((e) => (
        <div key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: e.farbe ?? "#999" }} />
            <span className={"font-medium " + (e.aktiv ? "" : "text-muted-foreground line-through")}>{e.name}</span>
            <span className="text-sm text-muted-foreground">{e.wochenstunden > 0 ? `${e.wochenstunden} h/Woche` : "ohne Soll"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggle(e)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground">
              {e.aktiv ? "Deaktivieren" : "Aktivieren"}
            </button>
            <button type="button" aria-label={`${e.name} löschen`} onClick={() => remove(e.id)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
              Löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `MitarbeiterView.tsx`**

```tsx
import { useState } from "react";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeList } from "./EmployeeList";

export function MitarbeiterView() {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="space-y-6">
      <EmployeeForm onSaved={() => setReloadKey((k) => k + 1)} />
      <EmployeeList reloadKey={reloadKey} />
    </div>
  );
}
```

- [ ] **Step 4: Test schreiben** (`MitarbeiterView.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addEmployee = vi.fn();
const listEmployees = vi.fn();
const setEmployeeActive = vi.fn();
const deleteEmployee = vi.fn();
vi.mock("@/lib/db/employees", () => ({
  addEmployee: (...a: unknown[]) => addEmployee(...a),
  listEmployees: (...a: unknown[]) => listEmployees(...a),
  setEmployeeActive: (...a: unknown[]) => setEmployeeActive(...a),
  deleteEmployee: (...a: unknown[]) => deleteEmployee(...a),
}));

import { MitarbeiterView } from "./MitarbeiterView";

beforeEach(() => {
  addEmployee.mockReset(); listEmployees.mockReset(); setEmployeeActive.mockReset(); deleteEmployee.mockReset();
  listEmployees.mockResolvedValue([]);
});

describe("MitarbeiterView", () => {
  it("legt einen Mitarbeiter an", async () => {
    addEmployee.mockResolvedValue(undefined);
    render(<MitarbeiterView />);
    await userEvent.type(screen.getByLabelText("Name"), "Anna");
    await userEvent.type(screen.getByLabelText("Wochenstunden"), "38,5");
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addEmployee).toHaveBeenCalledWith({ name: "Anna", wochenstunden: 38.5, farbe: expect.any(String) });
  });

  it("zeigt geladene Mitarbeiter", async () => {
    listEmployees.mockResolvedValue([{ id: 1, name: "Bernd", wochenstunden: 20, farbe: "#3b82f6", aktiv: true }]);
    render(<MitarbeiterView />);
    expect(await screen.findByText("Bernd")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Tests → PASS** — Run: `npx vitest run src/features/shifts/MitarbeiterView.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/shifts/EmployeeForm.tsx src/features/shifts/EmployeeList.tsx src/features/shifts/MitarbeiterView.tsx src/features/shifts/MitarbeiterView.test.tsx && git commit -m "feat(schichten): Mitarbeiter-Tab (Form, Liste, View)"
```

---

### Task 8: Vorlagen-Tab (`PresetView`)

**Files:**
- Create: `src/features/shifts/PresetView.tsx`
- Test: `src/features/shifts/PresetView.test.tsx`

- [ ] **Step 1: `PresetView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { listPresets, addPreset, deletePreset, type ShiftPreset } from "@/lib/db/shiftPresets";

export function PresetView() {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [name, setName] = useState("");
  const [start, setStart] = useState("08:00");
  const [ende, setEnde] = useState("14:00");
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    try { setPresets(await listPresets()); setFehler(null); }
    catch { setFehler("Vorlagen konnten nicht geladen werden."); }
  }
  useEffect(() => { reload(); }, []);

  async function add() {
    if (name.trim() === "") { setFehler("Bitte einen Namen eingeben."); return; }
    try { await addPreset({ name: name.trim(), start, ende }); setName(""); await reload(); }
    catch { setFehler("Hinzufügen fehlgeschlagen."); }
  }
  async function remove(id: number) {
    try { await deletePreset(id); await reload(); }
    catch { setFehler("Löschen fehlgeschlagen."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input aria-label="Vorlagenname" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Mittag" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Von</span>
          <input aria-label="Von" type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Bis</span>
          <input aria-label="Bis" type="time" value={ende} onChange={(e) => setEnde(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <button type="button" onClick={add}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Hinzufügen
        </button>
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {presets.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Vorlagen.</p>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-medium">{p.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{p.start}–{p.ende}</span>
                <button type="button" aria-label={`${p.name} löschen`} onClick={() => remove(p.id)}
                  className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test schreiben** (`PresetView.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listPresets = vi.fn();
const addPreset = vi.fn();
const deletePreset = vi.fn();
vi.mock("@/lib/db/shiftPresets", () => ({
  listPresets: (...a: unknown[]) => listPresets(...a),
  addPreset: (...a: unknown[]) => addPreset(...a),
  deletePreset: (...a: unknown[]) => deletePreset(...a),
}));

import { PresetView } from "./PresetView";

beforeEach(() => {
  listPresets.mockReset(); addPreset.mockReset(); deletePreset.mockReset();
  listPresets.mockResolvedValue([{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }]);
});

describe("PresetView", () => {
  it("zeigt vorhandene Vorlagen", async () => {
    render(<PresetView />);
    expect(await screen.findByText("Früh")).toBeInTheDocument();
    expect(screen.getByText("08:00–14:00")).toBeInTheDocument();
  });
  it("legt eine Vorlage an", async () => {
    addPreset.mockResolvedValue(undefined);
    render(<PresetView />);
    await screen.findByText("Früh");
    await userEvent.type(screen.getByLabelText("Vorlagenname"), "Mittag");
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addPreset).toHaveBeenCalledWith({ name: "Mittag", start: "08:00", ende: "14:00" });
  });
});
```

- [ ] **Step 3: Tests → PASS** — Run: `npx vitest run src/features/shifts/PresetView.test.tsx` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/shifts/PresetView.tsx src/features/shifts/PresetView.test.tsx && git commit -m "feat(schichten): Vorlagen-Tab (PresetView)"
```

---

### Task 9: `ShiftCellEditor` (Popover zum Bearbeiten einer Zelle)

**Files:**
- Create: `src/features/shifts/ShiftCellEditor.tsx`
- Test: `src/features/shifts/ShiftCellEditor.test.tsx`

- [ ] **Step 1: `ShiftCellEditor.tsx`**

```tsx
import { useState } from "react";
import type { ShiftPreset } from "@/lib/db/shiftPresets";
import { shiftHours } from "./hours";

export interface ShiftCellEditorProps {
  employeeName: string;
  datumLabel: string;
  presets: ShiftPreset[];
  initialStart: string | null;
  initialEnde: string | null;
  onSave: (start: string, ende: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ShiftCellEditor({
  employeeName, datumLabel, presets, initialStart, initialEnde, onSave, onDelete, onClose,
}: ShiftCellEditorProps) {
  const [start, setStart] = useState(initialStart ?? "08:00");
  const [ende, setEnde] = useState(initialEnde ?? "14:00");
  const dauer = shiftHours(start, ende);

  return (
    <div role="dialog" aria-label={`${employeeName} · ${datumLabel}`}
      className="absolute z-20 w-64 space-y-3 rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="text-sm font-semibold">{employeeName} · {datumLabel}</div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p.id} type="button" onClick={() => { setStart(p.start); setEnde(p.ende); }}
            className="rounded-lg border border-border px-2 py-1 text-xs">
            {p.name} {p.start}–{p.ende}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input aria-label="Von" type="time" value={start} onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-border px-2 py-1" />
        <span>–</span>
        <input aria-label="Bis" type="time" value={ende} onChange={(e) => setEnde(e.target.value)}
          className="rounded-lg border border-border px-2 py-1" />
      </div>
      {dauer === 0
        ? <p className="text-xs text-amber-600">„Bis" muss nach „Von" liegen.</p>
        : <p className="text-xs text-muted-foreground">{dauer} h</p>}
      <div className="flex justify-between">
        <button type="button" onClick={onDelete}
          className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
          Löschen
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-2 py-1 text-sm">Abbrechen</button>
          <button type="button" disabled={dauer === 0} onClick={() => onSave(start, ende)}
            className="rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test schreiben** (`ShiftCellEditor.test.tsx`)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShiftCellEditor } from "./ShiftCellEditor";

const presets = [{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }];

function setup(over = {}) {
  const onSave = vi.fn(); const onDelete = vi.fn(); const onClose = vi.fn();
  render(<ShiftCellEditor employeeName="Anna" datumLabel="Mo 01.06." presets={presets}
    initialStart={null} initialEnde={null} onSave={onSave} onDelete={onDelete} onClose={onClose} {...over} />);
  return { onSave, onDelete, onClose };
}

describe("ShiftCellEditor", () => {
  it("übernimmt eine Vorlage und speichert deren Zeiten", async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Früh 08:00–14:00/ }));
    await userEvent.click(screen.getByRole("button", { name: /speichern/i }));
    expect(onSave).toHaveBeenCalledWith("08:00", "14:00");
  });
  it("deaktiviert Speichern bei ungültiger Spanne", async () => {
    setup({ initialStart: "14:00", initialEnde: "08:00" });
    expect(screen.getByRole("button", { name: /speichern/i })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Tests → PASS** — Run: `npx vitest run src/features/shifts/ShiftCellEditor.test.tsx` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/shifts/ShiftCellEditor.tsx src/features/shifts/ShiftCellEditor.test.tsx && git commit -m "feat(schichten): ShiftCellEditor Popover"
```

---

### Task 10: `WochenplanView` (Raster + Navigation + Summen)

**Files:**
- Create: `src/features/shifts/WochenplanView.tsx`
- Test: `src/features/shifts/WochenplanView.test.tsx`

- [ ] **Step 1: `WochenplanView.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { listEmployees, type Employee } from "@/lib/db/employees";
import { listPresets, type ShiftPreset } from "@/lib/db/shiftPresets";
import { listShiftsForWeek, upsertShift, deleteShift, type Shift } from "@/lib/db/shifts";
import { weekDays, weekLabel, addWeeks } from "./week";
import { shiftHours, sumHours, auslastung } from "./hours";
import { ShiftCellEditor } from "./ShiftCellEditor";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface CellSel { employeeId: number; datum: string }

export function WochenplanView() {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sel, setSel] = useState<CellSel | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const days = weekDays(anchor);

  const reload = useCallback(async () => {
    try {
      const [emp, pre, sh] = await Promise.all([listEmployees(), listPresets(), listShiftsForWeek(days)]);
      setEmployees(emp); setPresets(pre); setShifts(sh); setFehler(null);
    } catch {
      setFehler("Plan konnte nicht geladen werden.");
    }
    // days ist aus anchor abgeleitet -> anchor als dep genügt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  useEffect(() => { reload(); }, [reload]);

  function shiftAt(employeeId: number, datum: string): Shift | undefined {
    return shifts.find((s) => s.employeeId === employeeId && s.datum === datum);
  }

  async function save(employeeId: number, datum: string, start: string, ende: string) {
    try { await upsertShift(employeeId, datum, start, ende); setSel(null); await reload(); }
    catch { setFehler("Speichern fehlgeschlagen."); }
  }
  async function remove(employeeId: number, datum: string) {
    const s = shiftAt(employeeId, datum);
    try { if (s) await deleteShift(s.id); setSel(null); await reload(); }
    catch { setFehler("Löschen fehlgeschlagen."); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Woche zurück" onClick={() => setAnchor(addWeeks(anchor, -1))}
          className="rounded-lg border border-border px-2 py-1">‹</button>
        <span className="min-w-[16rem] text-center font-semibold">{weekLabel(anchor)}</span>
        <button type="button" aria-label="Woche vor" onClick={() => setAnchor(addWeeks(anchor, 1))}
          className="rounded-lg border border-border px-2 py-1">›</button>
        <button type="button" onClick={() => setAnchor(new Date())}
          className="rounded-lg border border-border px-3 py-1 text-sm">Heute</button>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {employees.length === 0 && (
        <p className="text-muted-foreground">Lege zuerst im Tab „Mitarbeiter" jemanden an.</p>
      )}

      {employees.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border px-2 py-1 text-left">Mitarbeiter</th>
                {days.map((d, i) => (
                  <th key={d} className="border border-border px-2 py-1 text-center">
                    {WOCHENTAGE[i]}<br /><span className="text-xs text-muted-foreground">{d.slice(8, 10)}.{d.slice(5, 7)}.</span>
                  </th>
                ))}
                <th className="border border-border px-2 py-1 text-right">Woche</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const eigene = shifts.filter((s) => s.employeeId === e.id);
                const ist = sumHours(eigene);
                const a = auslastung(ist, e.wochenstunden);
                return (
                  <tr key={e.id}>
                    <td className="border border-border px-2 py-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: e.farbe ?? "#999" }} />
                        {e.name}
                      </span>
                    </td>
                    {days.map((d) => {
                      const s = shiftAt(e.id, d);
                      const open = sel?.employeeId === e.id && sel?.datum === d;
                      return (
                        <td key={d} className="relative border border-border p-0 text-center">
                          <button type="button"
                            aria-label={`${e.name} ${d} bearbeiten`}
                            onClick={() => setSel({ employeeId: e.id, datum: d })}
                            className="h-full w-full px-2 py-2 hover:bg-accent">
                            {s ? (
                              <span className="rounded px-1 text-xs" style={{ backgroundColor: (e.farbe ?? "#999") + "33" }}>
                                {s.start}–{s.ende}
                              </span>
                            ) : <span className="text-muted-foreground">+</span>}
                          </button>
                          {open && (
                            <ShiftCellEditor
                              employeeName={e.name}
                              datumLabel={`${d.slice(8, 10)}.${d.slice(5, 7)}.`}
                              presets={presets}
                              initialStart={s?.start ?? null}
                              initialEnde={s?.ende ?? null}
                              onSave={(start, ende) => save(e.id, d, start, ende)}
                              onDelete={() => remove(e.id, d)}
                              onClose={() => setSel(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-border px-2 py-1 text-right">
                      <div className="font-medium">{Math.round(ist * 10) / 10} h</div>
                      {e.wochenstunden > 0 && (
                        <div className={"text-xs " + (a.diff > 0 ? "text-amber-600" : "text-emerald-700")}>
                          {a.diff > 0 ? `+${Math.round(a.diff * 10) / 10} h Über` : `${Math.round(-a.diff * 10) / 10} h frei`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test schreiben** (`WochenplanView.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listEmployees = vi.fn();
const listPresets = vi.fn();
const listShiftsForWeek = vi.fn();
const upsertShift = vi.fn();
const deleteShift = vi.fn();
vi.mock("@/lib/db/employees", () => ({ listEmployees: (...a: unknown[]) => listEmployees(...a) }));
vi.mock("@/lib/db/shiftPresets", () => ({ listPresets: (...a: unknown[]) => listPresets(...a) }));
vi.mock("@/lib/db/shifts", () => ({
  listShiftsForWeek: (...a: unknown[]) => listShiftsForWeek(...a),
  upsertShift: (...a: unknown[]) => upsertShift(...a),
  deleteShift: (...a: unknown[]) => deleteShift(...a),
}));

import { WochenplanView } from "./WochenplanView";

beforeEach(() => {
  listEmployees.mockReset(); listPresets.mockReset(); listShiftsForWeek.mockReset();
  upsertShift.mockReset(); deleteShift.mockReset();
  listPresets.mockResolvedValue([{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }]);
});

describe("WochenplanView", () => {
  it("zeigt einen Hinweis ohne Mitarbeiter", async () => {
    listEmployees.mockResolvedValue([]);
    listShiftsForWeek.mockResolvedValue([]);
    render(<WochenplanView />);
    expect(await screen.findByText(/zuerst im Tab/i)).toBeInTheDocument();
  });

  it("zeigt Mitarbeiter, Schicht-Chip und Wochensumme/Auslastung", async () => {
    listEmployees.mockResolvedValue([{ id: 1, name: "Anna", wochenstunden: 10, farbe: "#3b82f6", aktiv: true }]);
    listShiftsForWeek.mockImplementation(async (days: string[]) => [
      { id: 9, employeeId: 1, datum: days[0], start: "08:00", ende: "14:00" },
    ]);
    render(<WochenplanView />);
    expect(await screen.findByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("08:00–14:00")).toBeInTheDocument();
    expect(screen.getByText("6 h")).toBeInTheDocument();        // Ist
    expect(screen.getByText("4 h frei")).toBeInTheDocument();   // 10 Soll - 6 Ist
  });

  it("speichert eine neue Schicht über den Editor", async () => {
    listEmployees.mockResolvedValue([{ id: 1, name: "Anna", wochenstunden: 0, farbe: null, aktiv: true }]);
    listShiftsForWeek.mockResolvedValue([]);
    upsertShift.mockResolvedValue(undefined);
    render(<WochenplanView />);
    await screen.findByText("Anna");
    const firstCell = screen.getAllByRole("button", { name: /Anna .* bearbeiten/i })[0];
    await userEvent.click(firstCell);
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Früh 08:00–14:00/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /speichern/i }));
    expect(upsertShift).toHaveBeenCalledTimes(1);
    expect(upsertShift.mock.calls[0][2]).toBe("08:00");
    expect(upsertShift.mock.calls[0][3]).toBe("14:00");
  });
});
```

- [ ] **Step 3: Tests → PASS** — Run: `npx vitest run src/features/shifts/WochenplanView.test.tsx` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/shifts/WochenplanView.tsx src/features/shifts/WochenplanView.test.tsx && git commit -m "feat(schichten): Wochenplan-Raster mit Summen & Auslastung"
```

---

### Task 11: `ShiftModule` + Route, `ShiftsPlaceholder` ablösen

**Files:**
- Create: `src/routes/shifts/ShiftModule.tsx`
- Test: `src/routes/shifts/ShiftModule.test.tsx`
- Modify: `src/App.tsx` (Import + Route)
- Delete: `src/routes/modules/ShiftsPlaceholder.tsx`

- [ ] **Step 1: `ShiftModule.tsx`**

```tsx
import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { WochenplanView } from "@/features/shifts/WochenplanView";
import { MitarbeiterView } from "@/features/shifts/MitarbeiterView";
import { PresetView } from "@/features/shifts/PresetView";

type Tab = "plan" | "mitarbeiter" | "vorlagen";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "mitarbeiter", label: "Mitarbeiter" },
  { id: "vorlagen", label: "Vorlagen" },
];

export function ShiftModule() {
  const [tab, setTab] = useState<Tab>("plan");
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <BackLink />
      <h1 className="mb-6 text-2xl font-bold text-foreground">Schichten</h1>
      <div role="tablist" className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={"px-4 py-2 text-sm font-medium " +
              (tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "plan" && <WochenplanView />}
      {tab === "mitarbeiter" && <MitarbeiterView />}
      {tab === "vorlagen" && <PresetView />}
    </main>
  );
}
```

- [ ] **Step 2: Route umstellen** in `src/App.tsx`: ersetze
`import { ShiftsPlaceholder } from "@/routes/modules/ShiftsPlaceholder";` durch
`import { ShiftModule } from "@/routes/shifts/ShiftModule";`
und `<Route path="/shifts" element={<ShiftsPlaceholder />} />` durch
`<Route path="/shifts" element={<ShiftModule />} />`.

- [ ] **Step 3: Test schreiben** (`ShiftModule.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/db/employees", () => ({ listEmployees: vi.fn(async () => []) }));
vi.mock("@/lib/db/shiftPresets", () => ({ listPresets: vi.fn(async () => []) }));
vi.mock("@/lib/db/shifts", () => ({
  listShiftsForWeek: vi.fn(async () => []),
  upsertShift: vi.fn(), deleteShift: vi.fn(),
}));

import { ShiftModule } from "./ShiftModule";

beforeEach(() => {});

describe("ShiftModule", () => {
  it("zeigt den Plan-Tab mit Wochen-Navigation und einen Back-Link", async () => {
    render(<MemoryRouter><ShiftModule /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /plan/i })).toBeInTheDocument();
    expect(await screen.findByText(/zuerst im Tab/i)).toBeInTheDocument();
  });
  it("wechselt zum Mitarbeiter-Tab", async () => {
    render(<MemoryRouter><ShiftModule /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /mitarbeiter/i }));
    expect(await screen.findByText(/noch keine mitarbeiter/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: `ShiftsPlaceholder.tsx` löschen.**

```bash
git rm src/routes/modules/ShiftsPlaceholder.tsx
```

- [ ] **Step 5: Volle Suite + Build** — Run: `npm test` (alle grün), `npm run build`. Falls ein Test noch den Placeholder erwartet: anpassen.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(schichten): ShiftModule mit Tabs, Route /shifts aktiviert"
```

---

## Abschluss-Verifikation
- `npm test` → alle grün (neu: week, hours, 3 Datenschichten, MitarbeiterView, PresetView, ShiftCellEditor, WochenplanView, ShiftModule).
- `npm run build` → grün. `cd src-tauri && cargo build` → grün.
- Tag `v0.11.0`, push, FF-Merge nach `main` (finishing-a-development-branch).
- Danach Plan 2 (Urlaube, Warnungen, Druck) schreiben.
