# Checklisten 2 — Durchführung + Historie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Checklisten tatsächlich nutzbar machen: im **Heute**-Tab fällige Durchführungen je Periode abhaken (Fortschritt + „Abschließen"), und im **Historie**-Tab die abgeschlossenen/offenen Durchführungen mit Zeitstempel als Nachweis sehen.

**Architecture:** `checklist_runs` (Migration v6, eine Durchführung pro `(template_id, periode)` mit eingefrorenem Snapshot). Reine Perioden-/Fortschritts-Logik (`period.ts`). Datenzugriff `src/lib/db/runs.ts` (get/getOrCreate/updateItemStates/complete/list) auf der geteilten `connection.ts`. UI: `HeuteRunCard` (eine Vorlage = eine Karte mit Checkboxen, lazy Durchführung), `HeuteView`, `HistorieView` — eingehängt in die bestehenden `ChecklistModule`-Tabs.

**Tech Stack:** Tauri 2 (`tauri-plugin-sql`/SQLite, Migration v6), React 19 + TypeScript, Tailwind, Vitest + Testing Library. Baut auf `src/lib/db/templates.ts`.

---

## File Structure

```
src-tauri/src/lib.rs                          # Migration v6 (checklist_runs)
src/features/checklists/period.ts             # currentPeriod + runProgress (rein, + Test)
src/features/checklists/period.test.ts
src/lib/db/runs.ts                            # get/getOrCreate/updateItemStates/complete/list (+ Test)
src/lib/db/runs.test.ts
src/features/checklists/HeuteRunCard.tsx      # eine Vorlage durchführen (Checkboxen)
src/features/checklists/HeuteView.tsx         # alle fälligen Vorlagen (+ Test)
src/features/checklists/HeuteView.test.tsx
src/features/checklists/HistorieView.tsx      # abgeschlossene/offene Durchführungen (+ Test)
src/features/checklists/HistorieView.test.tsx
src/routes/checklists/ChecklistModule.tsx     # Heute/Historie-Tabs verdrahten
src/routes/checklists/ChecklistModule.test.tsx
```

---

## Task 1: Migration v6 — checklist_runs

**Files:** Modify `src-tauri/src/lib.rs`

- [ ] **Step 1: Migration v6 ergänzen**

In `src-tauri/src/lib.rs` den `migrations`-Vektor um eine sechste Migration erweitern (v1–v5 unverändert):
```rust
    Migration {
        version: 6,
        description: "create_checklist_runs",
        sql: "
            CREATE TABLE checklist_runs (
              id INTEGER PRIMARY KEY,
              template_id INTEGER REFERENCES checklist_templates(id) ON DELETE SET NULL,
              periode TEXT NOT NULL,
              snapshot_json TEXT NOT NULL,
              item_states_json TEXT NOT NULL DEFAULT '{}',
              notiz TEXT,
              erstellt_am TEXT NOT NULL,
              abgeschlossen_am TEXT,
              UNIQUE(template_id, periode)
            );
        ",
        kind: MigrationKind::Up,
    },
```

- [ ] **Step 2: Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: `Finished` ohne Fehler.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(checklists): migration v6 (checklist_runs)"
```

---

## Task 2: Perioden-/Fortschritts-Logik (rein) — TDD

**Files:** Create `src/features/checklists/period.ts` + test

- [ ] **Step 1: Failing Test**

Create `src/features/checklists/period.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { currentPeriod, runProgress } from "./period";

describe("currentPeriod", () => {
  it("returns the ISO date for daily", () => {
    expect(currentPeriod("taeglich", new Date(2026, 4, 31))).toBe("2026-05-31");
    expect(currentPeriod("taeglich", new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("returns the ISO week for weekly", () => {
    expect(currentPeriod("woechentlich", new Date(2026, 0, 1))).toBe("2026-W01"); // Do
    expect(currentPeriod("woechentlich", new Date(2026, 0, 5))).toBe("2026-W02"); // Mo
    expect(currentPeriod("woechentlich", new Date(2025, 11, 29))).toBe("2026-W01"); // Jahreswechsel
  });
});

describe("runProgress", () => {
  it("counts done vs total over the snapshot items", () => {
    const items = [{ id: "a", label: "x" }, { id: "b", label: "y" }, { id: "c", label: "z" }];
    expect(runProgress({ a: true, b: false }, items)).toEqual({ done: 1, total: 3 });
    expect(runProgress({}, items)).toEqual({ done: 0, total: 3 });
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- checklists/period`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checklists/period.ts`:
```ts
import type { ChecklistItem, Frequenz } from "@/lib/db/templates";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO-Woche als "YYYY-Www". Rechnet über eine UTC-Hilfsdatum aus den lokalen Y/M/D. */
function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7; // Mo=0 … So=6
  date.setUTCDate(date.getUTCDate() - day + 3); // Donnerstag dieser Woche
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThu.getTime()) / 604800000);
  return `${date.getUTCFullYear()}-W${pad2(week)}`;
}

/** Aktuelle Periode einer Vorlage: ISO-Datum (täglich) bzw. ISO-Woche (wöchentlich). */
export function currentPeriod(frequenz: Frequenz, date: Date): string {
  if (frequenz === "woechentlich") return isoWeekString(date);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Anzahl erledigter Punkte je Snapshot. */
export function runProgress(
  itemStates: Record<string, boolean>,
  items: ChecklistItem[],
): { done: number; total: number } {
  const done = items.filter((i) => itemStates[i.id] === true).length;
  return { done, total: items.length };
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- checklists/period`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/checklists/period.ts src/features/checklists/period.test.ts
git commit -m "feat(checklists): pure period + progress helpers"
```

---

## Task 3: Durchführungs-Datenzugriff — TDD

**Files:** Create `src/lib/db/runs.ts` + test

- [ ] **Step 1: Failing Test (SQL gemockt)**

Create `src/lib/db/runs.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { getRun, getOrCreateRun, updateItemStates, completeRun, listRuns } from "./runs";
import type { ChecklistTemplate } from "./templates";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

const row = {
  id: 5, template_id: 1, periode: "2026-05-31",
  snapshot_json: '{"name":"Öffnen","frequenz":"taeglich","items":[{"id":"o1","label":"Kasse"}]}',
  item_states_json: '{"o1":true}', notiz: null, abgeschlossen_am: null,
};

describe("getRun", () => {
  it("maps a row to a ChecklistRun or null", async () => {
    select.mockResolvedValueOnce([]);
    expect(await getRun(1, "2026-05-31")).toBeNull();
    select.mockResolvedValueOnce([row]);
    const run = await getRun(1, "2026-05-31");
    expect(run).toEqual({
      id: 5, templateId: 1, periode: "2026-05-31",
      snapshot: { name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }] },
      itemStates: { o1: true }, notiz: null, abgeschlossenAm: null,
    });
  });
});

describe("getOrCreateRun", () => {
  it("inserts a snapshot run when none exists, then returns it", async () => {
    const tmpl: ChecklistTemplate = { id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }] };
    select.mockResolvedValueOnce([]);       // erster getRun -> nichts
    execute.mockResolvedValueOnce(undefined); // insert
    select.mockResolvedValueOnce([row]);    // zweiter getRun -> erstellte Zeile
    const run = await getOrCreateRun(tmpl, "2026-05-31");
    expect(run.id).toBe(5);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO checklist_runs/i);
    expect(params[0]).toBe(1);
    expect(params[1]).toBe("2026-05-31");
    expect(params[2]).toBe('{"name":"Öffnen","frequenz":"taeglich","items":[{"id":"o1","label":"Kasse"}]}');
  });
});

describe("updateItemStates", () => {
  it("writes the states JSON for a run", async () => {
    execute.mockResolvedValue(undefined);
    await updateItemStates(5, { o1: true });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE checklist_runs SET item_states_json = \$1 WHERE id = \$2/i);
    expect(params).toEqual(['{"o1":true}', 5]);
  });
});

describe("completeRun", () => {
  it("sets abgeschlossen_am", async () => {
    execute.mockResolvedValue(undefined);
    await completeRun(5);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE checklist_runs SET abgeschlossen_am = \$1 WHERE id = \$2/i);
    expect(params[1]).toBe(5);
  });
});

describe("listRuns", () => {
  it("maps rows ordered by periode desc", async () => {
    select.mockResolvedValue([row]);
    const list = await listRuns();
    expect(list[0].id).toBe(5);
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY periode DESC/i);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- db/runs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/db/runs.ts`:
```ts
import { getDb } from "./connection";
import type { ChecklistItem, ChecklistTemplate, Frequenz } from "./templates";

export interface RunSnapshot {
  name: string;
  frequenz: Frequenz;
  items: ChecklistItem[];
}

export interface ChecklistRun {
  id: number;
  templateId: number | null;
  periode: string;
  snapshot: RunSnapshot;
  itemStates: Record<string, boolean>;
  notiz: string | null;
  abgeschlossenAm: string | null;
}

interface RunRow {
  id: number;
  template_id: number | null;
  periode: string;
  snapshot_json: string;
  item_states_json: string;
  notiz: string | null;
  abgeschlossen_am: string | null;
}

function mapRow(r: RunRow): ChecklistRun {
  return {
    id: r.id,
    templateId: r.template_id,
    periode: r.periode,
    snapshot: JSON.parse(r.snapshot_json) as RunSnapshot,
    itemStates: JSON.parse(r.item_states_json) as Record<string, boolean>,
    notiz: r.notiz,
    abgeschlossenAm: r.abgeschlossen_am,
  };
}

export async function getRun(templateId: number, periode: string): Promise<ChecklistRun | null> {
  const db = await getDb();
  const rows = await db.select<RunRow[]>(
    "SELECT id, template_id, periode, snapshot_json, item_states_json, notiz, abgeschlossen_am FROM checklist_runs WHERE template_id = $1 AND periode = $2",
    [templateId, periode],
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function getOrCreateRun(template: ChecklistTemplate, periode: string): Promise<ChecklistRun> {
  const existing = await getRun(template.id, periode);
  if (existing) return existing;
  const db = await getDb();
  const snapshot: RunSnapshot = { name: template.name, frequenz: template.frequenz, items: template.items };
  await db.execute(
    "INSERT INTO checklist_runs (template_id, periode, snapshot_json, item_states_json, erstellt_am) VALUES ($1, $2, $3, '{}', $4)",
    [template.id, periode, JSON.stringify(snapshot), new Date().toISOString()],
  );
  const created = await getRun(template.id, periode);
  if (!created) throw new Error("Durchführung konnte nicht angelegt werden");
  return created;
}

export async function updateItemStates(runId: number, itemStates: Record<string, boolean>): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE checklist_runs SET item_states_json = $1 WHERE id = $2", [
    JSON.stringify(itemStates), runId,
  ]);
}

export async function completeRun(runId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE checklist_runs SET abgeschlossen_am = $1 WHERE id = $2", [
    new Date().toISOString(), runId,
  ]);
}

export async function listRuns(): Promise<ChecklistRun[]> {
  const db = await getDb();
  const rows = await db.select<RunRow[]>(
    "SELECT id, template_id, periode, snapshot_json, item_states_json, notiz, abgeschlossen_am FROM checklist_runs ORDER BY periode DESC, id DESC",
  );
  return rows.map(mapRow);
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- db/runs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/runs.ts src/lib/db/runs.test.ts
git commit -m "feat(checklists): run data access (get/getOrCreate/update/complete/list)"
```

---

## Task 4: HeuteRunCard + HeuteView — TDD

**Files:** Create `src/features/checklists/HeuteRunCard.tsx`, `src/features/checklists/HeuteView.tsx` + HeuteView test

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/features/checklists/HeuteView.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChecklistTemplate } from "@/lib/db/templates";
import type { ChecklistRun } from "@/lib/db/runs";

const tmpl: ChecklistTemplate = { id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse hochfahren" }] };
const freshRun: ChecklistRun = {
  id: 9, templateId: 1, periode: "X", snapshot: { name: "Öffnen", frequenz: "taeglich", items: tmpl.items },
  itemStates: {}, notiz: null, abgeschlossenAm: null,
};
const getOrCreateRun = vi.fn(async () => freshRun);
const updateItemStates = vi.fn(async () => {});
const completeRun = vi.fn(async () => {});
vi.mock("@/lib/db/templates", () => ({ listTemplates: vi.fn(async () => [tmpl]) }));
vi.mock("@/lib/db/runs", () => ({
  getRun: vi.fn(async () => null),
  getOrCreateRun: (...a: unknown[]) => getOrCreateRun(...a),
  updateItemStates: (...a: unknown[]) => updateItemStates(...a),
  completeRun: (...a: unknown[]) => completeRun(...a),
}));

import { HeuteView } from "./HeuteView";

describe("HeuteView", () => {
  it("shows each template and ticks an item (creates the run + writes state)", async () => {
    render(<HeuteView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Kasse hochfahren/i }));
    expect(getOrCreateRun).toHaveBeenCalledTimes(1);
    expect(updateItemStates).toHaveBeenCalledWith(9, { o1: true });
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- HeuteView`
Expected: FAIL.

- [ ] **Step 3: HeuteRunCard implementieren**

Create `src/features/checklists/HeuteRunCard.tsx`:
```tsx
import { useEffect, useState } from "react";
import type { ChecklistTemplate } from "@/lib/db/templates";
import { getRun, getOrCreateRun, updateItemStates, completeRun, type ChecklistRun } from "@/lib/db/runs";
import { currentPeriod, runProgress } from "./period";

export function HeuteRunCard({ template }: { template: ChecklistTemplate }) {
  const periode = currentPeriod(template.frequenz, new Date());
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getRun(template.id, periode).then((r) => { if (active) setRun(r); }).catch(() => {});
    return () => { active = false; };
  }, [template.id, periode]);

  const states = run?.itemStates ?? {};
  const { done, total } = runProgress(states, template.items);
  const abgeschlossen = run?.abgeschlossenAm != null;

  async function toggle(itemId: string, checked: boolean) {
    try {
      const r = run ?? (await getOrCreateRun(template, periode));
      const next = { ...r.itemStates, [itemId]: checked };
      await updateItemStates(r.id, next);
      setRun({ ...r, itemStates: next });
      setFehler(null);
    } catch {
      setFehler("Konnte nicht gespeichert werden.");
    }
  }

  async function abschliessen() {
    try {
      const r = run ?? (await getOrCreateRun(template, periode));
      await completeRun(r.id);
      setRun({ ...r, abgeschlossenAm: new Date().toISOString() });
    } catch {
      setFehler("Abschließen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{template.name}</span>
        <span className="text-sm text-muted-foreground">
          {template.frequenz === "woechentlich" ? "wöchentlich" : "täglich"} · {done}/{total}
          {abgeschlossen ? " · abgeschlossen" : ""}
        </span>
      </div>
      <div className="space-y-1">
        {template.items.map((i) => (
          <label key={i.id} className="flex items-center gap-2">
            <input type="checkbox" aria-label={i.label} checked={states[i.id] === true}
              onChange={(e) => toggle(i.id, e.target.checked)} />
            <span className={states[i.id] ? "text-muted-foreground line-through" : ""}>{i.label}</span>
          </label>
        ))}
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {!abgeschlossen && (
        <button type="button" onClick={abschliessen}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Abschließen
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: HeuteView implementieren**

Create `src/features/checklists/HeuteView.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listTemplates, type ChecklistTemplate } from "@/lib/db/templates";
import { HeuteRunCard } from "./HeuteRunCard";

export function HeuteView() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
  }, []);

  if (templates.length === 0) {
    return <p className="text-muted-foreground">Noch keine Vorlagen — lege im Tab „Vorlagen" eine an.</p>;
  }

  return (
    <div className="space-y-4">
      {templates.map((t) => <HeuteRunCard key={t.id} template={t} />)}
    </div>
  );
}
```

- [ ] **Step 5: Run → PASS**

Run: `npm test -- HeuteView`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/checklists/HeuteRunCard.tsx src/features/checklists/HeuteView.tsx src/features/checklists/HeuteView.test.tsx
git commit -m "feat(checklists): Heute view — tick items per period, complete"
```

---

## Task 5: HistorieView — TDD

**Files:** Create `src/features/checklists/HistorieView.tsx` + test

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/features/checklists/HistorieView.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChecklistRun } from "@/lib/db/runs";

const runs: ChecklistRun[] = [
  {
    id: 1, templateId: 1, periode: "2026-05-31",
    snapshot: { name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }, { id: "o2", label: "Licht" }] },
    itemStates: { o1: true }, notiz: null, abgeschlossenAm: "2026-05-31T08:00:00.000Z",
  },
];
vi.mock("@/lib/db/runs", () => ({ listRuns: vi.fn(async () => runs) }));

import { HistorieView } from "./HistorieView";

describe("HistorieView", () => {
  it("lists runs with period, progress and status", async () => {
    render(<HistorieView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    expect(screen.getByText(/2026-05-31/)).toBeInTheDocument();
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();          // Fortschritt
    expect(screen.getByText(/abgeschlossen/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- HistorieView`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checklists/HistorieView.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listRuns, type ChecklistRun } from "@/lib/db/runs";
import { runProgress } from "./period";

export function HistorieView() {
  const [runs, setRuns] = useState<ChecklistRun[]>([]);

  useEffect(() => {
    listRuns().then(setRuns).catch(() => {});
  }, []);

  if (runs.length === 0) {
    return <p className="text-muted-foreground">Noch keine Durchführungen.</p>;
  }

  return (
    <div className="space-y-2">
      {runs.map((r) => {
        const { done, total } = runProgress(r.itemStates, r.snapshot.items);
        const status = r.abgeschlossenAm
          ? `abgeschlossen ${new Date(r.abgeschlossenAm).toLocaleString("de-AT")}`
          : "offen";
        return (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-col">
              <span className="font-medium">{r.snapshot.name}</span>
              <span className="text-sm text-muted-foreground">{r.periode} · {status}</span>
            </div>
            <span className="text-sm font-medium">{done}/{total}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- HistorieView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/checklists/HistorieView.tsx src/features/checklists/HistorieView.test.tsx
git commit -m "feat(checklists): Historie view (runs with progress + status)"
```

---

## Task 6: In die Tabs einhängen — TDD

**Files:** Modify `src/routes/checklists/ChecklistModule.tsx`, `src/routes/checklists/ChecklistModule.test.tsx`

- [ ] **Step 1: ChecklistModule-Test anpassen**

In `src/routes/checklists/ChecklistModule.test.tsx` die Mocks erweitern (oben, zusätzlich zum bestehenden `templates`-Mock) und den „Heute"-Platzhalter-Test ersetzen. Ergänze die Mocks:
```tsx
vi.mock("@/lib/db/runs", () => ({
  getRun: vi.fn(async () => null),
  getOrCreateRun: vi.fn(),
  updateItemStates: vi.fn(),
  completeRun: vi.fn(),
  listRuns: vi.fn(async () => []),
}));
```
Ersetze den Test „shows the Heute placeholder by default" durch:
```tsx
  it("shows the Heute tab content by default", async () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    expect(await screen.findByText(/lege im tab/i)).toBeInTheDocument();
  });

  it("switches to the Historie tab", async () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /historie/i }));
    expect(await screen.findByText(/noch keine durchführungen/i)).toBeInTheDocument();
  });
```
(Der bestehende `templates`-Mock liefert `listTemplates: async () => []` → HeuteView zeigt den „lege … an"-Hinweis; HistorieView zeigt „Noch keine Durchführungen.".)

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- ChecklistModule`
Expected: FAIL (noch „bald verfügbar"-Platzhalter).

- [ ] **Step 3: Tabs verdrahten**

In `src/routes/checklists/ChecklistModule.tsx` die Imports ergänzen:
```tsx
import { HeuteView } from "@/features/checklists/HeuteView";
import { HistorieView } from "@/features/checklists/HistorieView";
```
und die zwei Platzhalter-Zweige ersetzen. Aus:
```tsx
      {tab === "heute" && <p className="text-muted-foreground">Heute — bald verfügbar.</p>}
      {tab === "vorlagen" && <VorlagenView />}
      {tab === "historie" && <p className="text-muted-foreground">Historie — bald verfügbar.</p>}
```
wird:
```tsx
      {tab === "heute" && <HeuteView />}
      {tab === "vorlagen" && <VorlagenView />}
      {tab === "historie" && <HistorieView />}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- ChecklistModule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/checklists/ChecklistModule.tsx src/routes/checklists/ChecklistModule.test.tsx
git commit -m "feat(checklists): wire Heute + Historie tabs"
```

---

## Task 7: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build** (Exit-Code prüfen, NICHT durch `tail` pipen)

Run: `npm test` → alle grün.
Run: `npm run build` → keine TS-Fehler.

- [ ] **Step 2: Rust-Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: ohne Fehler (Migration v6 kompiliert).

- [ ] **Step 3: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.9.0 -m "v0.9.0 — Checklisten (Durchführung + Historie)"
git push --follow-tags
```

---

## Definition of Done

- **Heute**-Tab: für jede Vorlage eine Karte mit Checkboxen für die aktuelle Periode (Tag/Woche);
  Abhaken speichert (legt die Durchführung lazy an), Fortschritt x/y, **„Abschließen"** mit Zeitstempel.
- **Historie**-Tab: Durchführungen (neueste zuerst) mit Periode, Fortschritt und Status (offen/abgeschlossen am …).
- Auto-Reset: neue Periode → frische Durchführung; alte bleibt als Nachweis.
- Migration v6 legt `checklist_runs` an (eine Durchführung pro Vorlage+Periode).
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo build` sauber.
- Stand getaggt **`v0.9.0`** und gepusht.

## Bewusst NICHT in v1

- Notiz je Durchführung (Spalte vorhanden, UI später), Re-Open abgeschlossener Durchführungen,
  Export der Nachweise.
