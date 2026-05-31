# Checklisten 1 — Vorlagen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Checklisten-Modul (Plan 1) unter `/checklists`: Checklisten-**Vorlagen** anlegen/bearbeiten (Name, Frequenz täglich/wöchentlich, flache Punktliste) und löschen, mit drei vorbefüllten Seed-Vorlagen — Heute/Historie bleiben „bald"-Platzhalter (Plan 2).

**Architecture:** `checklist_templates` (Migration v5, items als JSON in einer Spalte) + Datenzugriff `src/lib/db/templates.ts` (JSON ↔ `items[]`) auf der geteilten `connection.ts`. UI in kleinen Einheiten (`TemplateForm`, `TemplateList`, `VorlagenView`) unter einer Tab-Hülle `ChecklistModule`, analog zu `TillModule`/`InventoryModule`.

**Tech Stack:** Tauri 2 (`tauri-plugin-sql`/SQLite, Migration v5), React 19 + TypeScript, Tailwind, react-router, Vitest + Testing Library.

---

## File Structure

```
src-tauri/src/lib.rs                         # Migration v5 (checklist_templates) + Seeds
src/lib/db/templates.ts                      # list/add/update/delete (+ Test)
src/lib/db/templates.test.ts
src/features/checklists/TemplateForm.tsx     # Vorlage anlegen/bearbeiten (+ Test)
src/features/checklists/TemplateForm.test.tsx
src/features/checklists/TemplateList.tsx     # Vorlagen-Liste (Bearbeiten/Löschen)
src/features/checklists/VorlagenView.tsx     # Form + Liste + Editier-/Reload-State
src/routes/checklists/ChecklistModule.tsx    # Tabs (Heute | Vorlagen | Historie) + BackLink (+ Test)
src/routes/checklists/ChecklistModule.test.tsx
src/App.tsx                                  # /checklists -> ChecklistModule (Platzhalter raus)
```

---

## Task 1: Migration v5 — checklist_templates + Seeds

**Files:** Modify `src-tauri/src/lib.rs`

- [ ] **Step 1: Migration v5 ergänzen**

In `src-tauri/src/lib.rs` den `migrations`-Vektor um eine fünfte Migration erweitern (v1–v4 unverändert). Hinweis: Die JSON-Doppelanführungszeichen sind im Rust-String mit `\"` escaped; SQLite sieht dann gültiges JSON in einfachen Anführungszeichen.
```rust
    Migration {
        version: 5,
        description: "create_checklist_templates",
        sql: "
            CREATE TABLE checklist_templates (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              frequenz TEXT NOT NULL DEFAULT 'taeglich',
              items_json TEXT NOT NULL DEFAULT '[]',
              erstellt_am TEXT NOT NULL
            );
            INSERT INTO checklist_templates (name, frequenz, items_json, erstellt_am) VALUES
              ('Öffnen', 'taeglich', '[{\"id\":\"o1\",\"label\":\"Kasse hochfahren\"},{\"id\":\"o2\",\"label\":\"Licht & Schild einschalten\"},{\"id\":\"o3\",\"label\":\"Eingang aufsperren\"}]', '2026-05-31T00:00:00Z'),
              ('Schließen', 'taeglich', '[{\"id\":\"s1\",\"label\":\"Kasse zählen & abschließen\"},{\"id\":\"s2\",\"label\":\"Licht ausschalten\"},{\"id\":\"s3\",\"label\":\"Türen & Fenster prüfen\"},{\"id\":\"s4\",\"label\":\"Alarm aktivieren\"}]', '2026-05-31T00:00:00Z'),
              ('Wöchentlich', 'woechentlich', '[{\"id\":\"w1\",\"label\":\"Lager auf Mindestbestände prüfen\"},{\"id\":\"w2\",\"label\":\"Kühlung/Geräte reinigen\"},{\"id\":\"w3\",\"label\":\"Müll rausbringen\"}]', '2026-05-31T00:00:00Z');
        ",
        kind: MigrationKind::Up,
    },
```

- [ ] **Step 2: Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: `Finished` ohne Fehler. (NICHT `npm run tauri dev`.)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(checklists): migration v5 (checklist_templates + seeds)"
```

---

## Task 2: Datenzugriff — TDD

**Files:** Create `src/lib/db/templates.ts` + test

- [ ] **Step 1: Failing Test (SQL gemockt)**

Create `src/lib/db/templates.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listTemplates, addTemplate, updateTemplate, deleteTemplate } from "./templates";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("listTemplates", () => {
  it("parses items_json into items[]", async () => {
    select.mockResolvedValue([
      { id: 1, name: "Öffnen", frequenz: "taeglich", items_json: '[{"id":"o1","label":"Kasse"}]' },
    ]);
    const list = await listTemplates();
    expect(list[0]).toEqual({
      id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }],
    });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY name/i);
  });
});

describe("addTemplate", () => {
  it("inserts with items serialized to JSON", async () => {
    execute.mockResolvedValue(undefined);
    await addTemplate("Neu", "woechentlich", [{ id: "x", label: "Punkt" }]);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO checklist_templates/i);
    expect(params.slice(0, 3)).toEqual(["Neu", "woechentlich", '[{"id":"x","label":"Punkt"}]']);
  });
});

describe("updateTemplate", () => {
  it("updates name, frequenz, items by id", async () => {
    execute.mockResolvedValue(undefined);
    await updateTemplate(7, "Neu2", "taeglich", [{ id: "y", label: "P2" }]);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE checklist_templates SET name = \$1, frequenz = \$2, items_json = \$3 WHERE id = \$4/i);
    expect(params).toEqual(["Neu2", "taeglich", '[{"id":"y","label":"P2"}]', 7]);
  });
});

describe("deleteTemplate", () => {
  it("deletes by id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteTemplate(7);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM checklist_templates WHERE id = \$1/i);
    expect(params).toEqual([7]);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- db/templates`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/db/templates.ts`:
```ts
import { getDb } from "./connection";

export interface ChecklistItem {
  id: string;
  label: string;
}

export type Frequenz = "taeglich" | "woechentlich";

export interface ChecklistTemplate {
  id: number;
  name: string;
  frequenz: Frequenz;
  items: ChecklistItem[];
}

interface TemplateRow {
  id: number;
  name: string;
  frequenz: string;
  items_json: string;
}

export async function listTemplates(): Promise<ChecklistTemplate[]> {
  const db = await getDb();
  const rows = await db.select<TemplateRow[]>(
    "SELECT id, name, frequenz, items_json FROM checklist_templates ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    frequenz: r.frequenz === "woechentlich" ? "woechentlich" : "taeglich",
    items: JSON.parse(r.items_json) as ChecklistItem[],
  }));
}

export async function addTemplate(name: string, frequenz: Frequenz, items: ChecklistItem[]): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO checklist_templates (name, frequenz, items_json, erstellt_am) VALUES ($1, $2, $3, $4)",
    [name, frequenz, JSON.stringify(items), new Date().toISOString()],
  );
}

export async function updateTemplate(
  id: number, name: string, frequenz: Frequenz, items: ChecklistItem[],
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE checklist_templates SET name = $1, frequenz = $2, items_json = $3 WHERE id = $4",
    [name, frequenz, JSON.stringify(items), id],
  );
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM checklist_templates WHERE id = $1", [id]);
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- db/templates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/templates.ts src/lib/db/templates.test.ts
git commit -m "feat(checklists): template data access (list/add/update/delete)"
```

---

## Task 3: TemplateForm — TDD

**Files:** Create `src/features/checklists/TemplateForm.tsx` + test

- [ ] **Step 1: Failing Test**

Create `src/features/checklists/TemplateForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addTemplate = vi.fn();
const updateTemplate = vi.fn();
vi.mock("@/lib/db/templates", () => ({
  addTemplate: (...a: unknown[]) => addTemplate(...a),
  updateTemplate: (...a: unknown[]) => updateTemplate(...a),
}));

import { TemplateForm } from "./TemplateForm";

beforeEach(() => { addTemplate.mockReset(); updateTemplate.mockReset(); });

describe("TemplateForm", () => {
  it("blocks saving without a name", async () => {
    render(<TemplateForm onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /anlegen/i }));
    expect(addTemplate).not.toHaveBeenCalled();
    expect(screen.getByText(/namen eingeben/i)).toBeInTheDocument();
  });

  it("creates a template with added items", async () => {
    addTemplate.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<TemplateForm onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Mittags");
    await userEvent.type(screen.getByLabelText(/neuer punkt/i), "Kühlung prüfen");
    await userEvent.click(screen.getByRole("button", { name: /punkt hinzufügen/i }));
    await userEvent.click(screen.getByRole("button", { name: /anlegen/i }));
    expect(addTemplate).toHaveBeenCalledTimes(1);
    const [name, frequenz, items] = addTemplate.mock.calls[0];
    expect(name).toBe("Mittags");
    expect(frequenz).toBe("taeglich");
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Kühlung prüfen");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- TemplateForm`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checklists/TemplateForm.tsx`:
```tsx
import { useState } from "react";
import { addTemplate, updateTemplate, type ChecklistItem, type ChecklistTemplate, type Frequenz } from "@/lib/db/templates";

function newId(): string {
  return crypto.randomUUID();
}

export function TemplateForm({ initial, onSaved, onCancel }: {
  initial?: ChecklistTemplate | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [frequenz, setFrequenz] = useState<Frequenz>(initial?.frequenz ?? "taeglich");
  const [items, setItems] = useState<ChecklistItem[]>(initial?.items ?? []);
  const [neu, setNeu] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  function addItem() {
    const label = neu.trim();
    if (label === "") return;
    setItems([...items, { id: newId(), label }]);
    setNeu("");
  }
  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }
  function renameItem(id: string, label: string) {
    setItems(items.map((i) => (i.id === id ? { ...i, label } : i)));
  }

  async function save() {
    if (name.trim() === "") {
      setFehler("Bitte einen Namen eingeben.");
      return;
    }
    setFehler(null);
    try {
      if (initial) await updateTemplate(initial.id, name.trim(), frequenz, items);
      else await addTemplate(name.trim(), frequenz, items);
    } catch {
      setFehler("Speichern fehlgeschlagen.");
      return;
    }
    onSaved();
    if (!initial) { setName(""); setFrequenz("taeglich"); setItems([]); setNeu(""); }
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
          <span className="text-sm font-medium">Frequenz</span>
          <select aria-label="Frequenz" value={frequenz}
            onChange={(e) => setFrequenz(e.target.value as Frequenz)}
            className="rounded-xl border border-border px-3 py-2">
            <option value="taeglich">täglich</option>
            <option value="woechentlich">wöchentlich</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Punkte</span>
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <input aria-label={`Punkt ${i.label}`} value={i.label}
              onChange={(e) => renameItem(i.id, e.target.value)}
              className="flex-1 rounded-lg border border-border px-2 py-1" />
            <button type="button" aria-label={`Punkt ${i.label} entfernen`} onClick={() => removeItem(i.id)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
              Entfernen
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input aria-label="Neuer Punkt" value={neu} onChange={(e) => setNeu(e.target.value)}
            placeholder="Neuen Punkt eingeben…" className="flex-1 rounded-lg border border-border px-2 py-1" />
          <button type="button" onClick={addItem}
            className="rounded-lg border border-border px-3 py-1 text-sm">Punkt hinzufügen</button>
        </div>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={save}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {initial ? "Speichern" : "Anlegen"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm">Abbrechen</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- TemplateForm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/checklists/TemplateForm.tsx src/features/checklists/TemplateForm.test.tsx
git commit -m "feat(checklists): template editor form (name/frequency/items)"
```

---

## Task 4: TemplateList + VorlagenView — TDD

**Files:** Create `src/features/checklists/TemplateList.tsx`, `src/features/checklists/VorlagenView.tsx` + VorlagenView test

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/features/checklists/VorlagenView.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChecklistTemplate } from "@/lib/db/templates";
import { deleteTemplate } from "@/lib/db/templates";

const sample: ChecklistTemplate[] = [
  { id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }] },
  { id: 2, name: "Wöchentlich", frequenz: "woechentlich", items: [] },
];
vi.mock("@/lib/db/templates", () => ({
  listTemplates: vi.fn(async () => sample),
  addTemplate: vi.fn(async () => {}),
  updateTemplate: vi.fn(async () => {}),
  deleteTemplate: vi.fn(async () => {}),
}));

import { VorlagenView } from "./VorlagenView";

describe("VorlagenView", () => {
  it("lists templates and deletes one", async () => {
    render(<VorlagenView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    expect(screen.getByText("Wöchentlich")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Öffnen löschen/i }));
    expect(vi.mocked(deleteTemplate)).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- VorlagenView`
Expected: FAIL.

- [ ] **Step 3: TemplateList implementieren**

Create `src/features/checklists/TemplateList.tsx`:
```tsx
import type { ChecklistTemplate } from "@/lib/db/templates";

export function TemplateList({ templates, onEdit, onDelete }: {
  templates: ChecklistTemplate[];
  onEdit: (t: ChecklistTemplate) => void;
  onDelete: (id: number) => void;
}) {
  if (templates.length === 0) {
    return <p className="text-muted-foreground">Noch keine Vorlagen.</p>;
  }
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium">{t.name}</span>
            <span className="text-sm text-muted-foreground">
              {t.frequenz === "woechentlich" ? "wöchentlich" : "täglich"} · {t.items.length} Punkte
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label={`${t.name} bearbeiten`} onClick={() => onEdit(t)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-primary">Bearbeiten</button>
            <button type="button" aria-label={`${t.name} löschen`} onClick={() => onDelete(t.id)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">Löschen</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: VorlagenView implementieren**

Create `src/features/checklists/VorlagenView.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listTemplates, deleteTemplate, type ChecklistTemplate } from "@/lib/db/templates";
import { TemplateForm } from "./TemplateForm";
import { TemplateList } from "./TemplateList";

export function VorlagenView() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    try {
      setTemplates(await listTemplates());
      setFehler(null);
    } catch {
      setFehler("Vorlagen konnten nicht geladen werden.");
    }
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: number) {
    try {
      await deleteTemplate(id);
      if (editing?.id === id) setEditing(null);
      await reload();
    } catch {
      setFehler("Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      <TemplateForm
        key={editing?.id ?? "new"}
        initial={editing}
        onSaved={() => { setEditing(null); reload(); }}
        onCancel={editing ? () => setEditing(null) : undefined}
      />
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <TemplateList templates={templates} onEdit={(t) => setEditing(t)} onDelete={remove} />
    </div>
  );
}
```

- [ ] **Step 5: Run → PASS**

Run: `npm test -- VorlagenView`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/checklists/TemplateList.tsx src/features/checklists/VorlagenView.tsx src/features/checklists/VorlagenView.test.tsx
git commit -m "feat(checklists): template list + Vorlagen view (edit/delete)"
```

---

## Task 5: ChecklistModule + Route — TDD

**Files:** Create `src/routes/checklists/ChecklistModule.tsx` + test; modify `src/App.tsx`; delete `src/routes/modules/ChecklistsPlaceholder.tsx`

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/routes/checklists/ChecklistModule.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/db/templates", () => ({
  listTemplates: vi.fn(async () => []),
  addTemplate: vi.fn(async () => {}),
  updateTemplate: vi.fn(async () => {}),
  deleteTemplate: vi.fn(async () => {}),
}));

import { ChecklistModule } from "./ChecklistModule";

describe("ChecklistModule", () => {
  it("shows the Vorlagen tab with the editor + a back link", async () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /vorlagen/i }));
    expect(screen.getByRole("button", { name: /anlegen/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine vorlagen/i)).toBeInTheDocument();
  });

  it("shows the Heute placeholder by default", () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    expect(screen.getByText(/bald verfügbar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- ChecklistModule`
Expected: FAIL.

- [ ] **Step 3: ChecklistModule implementieren**

Create `src/routes/checklists/ChecklistModule.tsx`:
```tsx
import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { VorlagenView } from "@/features/checklists/VorlagenView";

type Tab = "heute" | "vorlagen" | "historie";

const TABS: { id: Tab; label: string }[] = [
  { id: "heute", label: "Heute" },
  { id: "vorlagen", label: "Vorlagen" },
  { id: "historie", label: "Historie" },
];

export function ChecklistModule() {
  const [tab, setTab] = useState<Tab>("heute");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <BackLink />
      <h1 className="mb-6 text-2xl font-bold text-foreground">Checklisten</h1>
      <div role="tablist" className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={
              "px-4 py-2 text-sm font-medium " +
              (tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground")
            }>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "heute" && <p className="text-muted-foreground">Heute — bald verfügbar.</p>}
      {tab === "vorlagen" && <VorlagenView />}
      {tab === "historie" && <p className="text-muted-foreground">Historie — bald verfügbar.</p>}
    </main>
  );
}
```

- [ ] **Step 4: Route umstellen**

In `src/App.tsx` den Import `ChecklistsPlaceholder` entfernen und ersetzen:
```tsx
import { ChecklistModule } from "@/routes/checklists/ChecklistModule";
```
und die Route ändern:
```tsx
      <Route path="/checklists" element={<ChecklistModule />} />
```
Die Datei `src/routes/modules/ChecklistsPlaceholder.tsx` löschen.

- [ ] **Step 5: Run → PASS**

Run: `npm test -- ChecklistModule`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(checklists): module tabs, wire /checklists route"
```

---

## Task 6: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build** (Exit-Code prüfen, NICHT durch `tail` pipen)

Run: `npm test` → alle grün.
Run: `npm run build` → keine TS-Fehler.

- [ ] **Step 2: Rust-Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: ohne Fehler (Migration v5 kompiliert).

- [ ] **Step 3: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.8.0 -m "v0.8.0 — Checklisten (Vorlagen)"
git push --follow-tags
```

---

## Definition of Done

- `/checklists` zeigt das Modul mit Tabs **Heute** (Platzhalter) · **Vorlagen** (nutzbar) ·
  **Historie** (Platzhalter) + Zurück-zum-Cockpit-Link.
- Drei Seed-Vorlagen (Öffnen/Schließen täglich, Wöchentlich) vorhanden; Vorlagen
  **anlegen/bearbeiten** (Name, Frequenz, Punkte hinzufügen/umbenennen/entfernen) und **löschen**.
- Migration v5 legt `checklist_templates` an.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo build` sauber.
- Stand getaggt **`v0.8.0`** und gepusht.

## Bewusst NICHT in Plan 1

- Durchführungen (Heute-Tab abhaken) + Historie — Plan 2 (Migration v6, `runs.ts`).
- Punkte umsortieren (Drag&Drop) — bei Bedarf später.
