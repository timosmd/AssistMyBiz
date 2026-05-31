# Lager — Artikel-Verwaltung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Lager-Modul (v1) unter `/inventory`: Artikel anlegen, in einer Liste pflegen (Bestand per +/− und Direkteingabe), Mindestbestand mit Unter-Minimum-Markierung, Suchen/Filtern und Löschen — der Bestell-Reiter bleibt ein „bald"-Platzhalter.

**Architecture:** Reine Logik (Low-Stock, Filter) getrennt von UI; Datenzugriff über `src/lib/db/articles.ts` auf der geteilten `connection.ts`; Migration v4 legt `articles` an. UI in kleinen Einheiten (`ArticleForm`, `ArticleRow`, `ArticleList`) unter einer Tab-Hülle `InventoryModule`, analog zum bestehenden `TillModule`.

**Tech Stack:** Tauri 2 (`tauri-plugin-sql`/SQLite, Migration v4), React 19 + TypeScript, Tailwind, react-router, Vitest + Testing Library.

---

## File Structure

```
src-tauri/src/lib.rs                       # Migration v4 (articles) ergänzen
src/lib/db/articles.ts                     # listArticles/addArticle/setBestand/deleteArticle (+ Test)
src/lib/db/articles.test.ts
src/features/inventory/articleFilter.ts    # isLowStock + filterArticles (rein, + Test)
src/features/inventory/articleFilter.test.ts
src/features/inventory/ArticleForm.tsx     # anlegen (+ Test)
src/features/inventory/ArticleForm.test.tsx
src/features/inventory/ArticleRow.tsx      # eine Zeile (Bestand +/−, Markierung, Löschen)
src/features/inventory/ArticleList.tsx     # Liste + Suchen/Filtern (+ Test)
src/features/inventory/ArticleList.test.tsx
src/routes/inventory/InventoryModule.tsx   # Tabs (Artikel | Bestellung) + BackLink (+ Test)
src/routes/inventory/InventoryModule.test.tsx
src/App.tsx                                # /inventory -> InventoryModule (Platzhalter raus)
```

---

## Task 1: Migration v4 — articles

**Files:** Modify `src-tauri/src/lib.rs`

- [ ] **Step 1: Migration v4 ergänzen**

In `src-tauri/src/lib.rs` den `migrations`-Vektor um eine vierte Migration erweitern (v1–v3 unverändert lassen):
```rust
    Migration {
        version: 4,
        description: "create_articles",
        sql: "
            CREATE TABLE articles (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              bestand INTEGER NOT NULL DEFAULT 0,
              mindestbestand INTEGER NOT NULL DEFAULT 0,
              einheit TEXT,
              lieferant TEXT,
              erstellt_am TEXT NOT NULL
            );
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
git commit -m "feat(lager): migration v4 (articles table)"
```

---

## Task 2: Reine Logik — TDD

**Files:** Create `src/features/inventory/articleFilter.ts` + test

- [ ] **Step 1: Failing Test**

Create `src/features/inventory/articleFilter.test.ts`:
```ts
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
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- articleFilter`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/inventory/articleFilter.ts`:
```ts
import type { Article } from "@/lib/db/articles";

export function isLowStock(a: Article): boolean {
  return a.bestand <= a.mindestbestand;
}

export function filterArticles(list: Article[], query: string): Article[] {
  const q = query.trim().toLowerCase();
  if (q === "") return list;
  return list.filter((a) => `${a.name} ${a.lieferant ?? ""}`.toLowerCase().includes(q));
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- articleFilter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/articleFilter.ts src/features/inventory/articleFilter.test.ts
git commit -m "feat(lager): pure low-stock + filter helpers"
```

---

## Task 3: Datenzugriff — TDD

**Files:** Create `src/lib/db/articles.ts` + test

- [ ] **Step 1: Failing Test (SQL gemockt)**

Create `src/lib/db/articles.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listArticles, addArticle, setBestand, deleteArticle } from "./articles";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("listArticles", () => {
  it("maps rows ordered by name", async () => {
    select.mockResolvedValue([
      { id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" },
    ]);
    const list = await listArticles();
    expect(list[0]).toEqual({ id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY name/i);
  });
});

describe("addArticle", () => {
  it("inserts the fields", async () => {
    execute.mockResolvedValue(undefined);
    await addArticle({ name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO articles/i);
    expect(params.slice(0, 5)).toEqual(["Mehl", 5, 3, "kg", "Müller"]);
  });
});

describe("setBestand", () => {
  it("updates bestand by id", async () => {
    execute.mockResolvedValue(undefined);
    await setBestand(7, 9);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE articles SET bestand = \$2 WHERE id = \$1/i);
    expect(params).toEqual([7, 9]);
  });
});

describe("deleteArticle", () => {
  it("deletes by id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteArticle(7);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM articles WHERE id = \$1/i);
    expect(params).toEqual([7]);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- db/articles`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/db/articles.ts`:
```ts
import { getDb } from "./connection";

export interface NewArticle {
  name: string;
  bestand: number;
  mindestbestand: number;
  einheit: string | null;
  lieferant: string | null;
}

export interface Article extends NewArticle {
  id: number;
}

interface ArticleRow {
  id: number;
  name: string;
  bestand: number;
  mindestbestand: number;
  einheit: string | null;
  lieferant: string | null;
}

export async function listArticles(): Promise<Article[]> {
  const db = await getDb();
  const rows = await db.select<ArticleRow[]>(
    "SELECT id, name, bestand, mindestbestand, einheit, lieferant FROM articles ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bestand: r.bestand,
    mindestbestand: r.mindestbestand,
    einheit: r.einheit,
    lieferant: r.lieferant,
  }));
}

export async function addArticle(a: NewArticle): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO articles (name, bestand, mindestbestand, einheit, lieferant, erstellt_am)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [a.name, a.bestand, a.mindestbestand, a.einheit, a.lieferant, new Date().toISOString()],
  );
}

export async function setBestand(id: number, bestand: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE articles SET bestand = $2 WHERE id = $1", [id, bestand]);
}

export async function deleteArticle(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM articles WHERE id = $1", [id]);
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- db/articles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/articles.ts src/lib/db/articles.test.ts
git commit -m "feat(lager): article data access (list/add/setBestand/delete)"
```

---

## Task 4: ArticleForm — TDD

**Files:** Create `src/features/inventory/ArticleForm.tsx` + test

- [ ] **Step 1: Failing Test**

Create `src/features/inventory/ArticleForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addArticle = vi.fn();
vi.mock("@/lib/db/articles", () => ({ addArticle: (...a: unknown[]) => addArticle(...a) }));

import { ArticleForm } from "./ArticleForm";

beforeEach(() => addArticle.mockReset());

describe("ArticleForm", () => {
  it("blocks saving without a name", async () => {
    render(<ArticleForm onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addArticle).not.toHaveBeenCalled();
    expect(screen.getByText(/namen eingeben/i)).toBeInTheDocument();
  });

  it("adds an article with the entered fields", async () => {
    addArticle.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<ArticleForm onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Mehl");
    await userEvent.type(screen.getByLabelText(/mindestbestand/i), "3");
    await userEvent.type(screen.getByLabelText(/lieferant/i), "Müller");
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addArticle).toHaveBeenCalledTimes(1);
    const arg = addArticle.mock.calls[0][0];
    expect(arg.name).toBe("Mehl");
    expect(arg.mindestbestand).toBe(3);
    expect(arg.lieferant).toBe("Müller");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- ArticleForm`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/inventory/ArticleForm.tsx`:
```tsx
import { useState } from "react";
import { addArticle } from "@/lib/db/articles";

function toInt(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ArticleForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [bestand, setBestand] = useState("");
  const [mindest, setMindest] = useState("");
  const [einheit, setEinheit] = useState("");
  const [lieferant, setLieferant] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function add() {
    if (name.trim() === "") {
      setFehler("Bitte einen Namen eingeben.");
      return;
    }
    setFehler(null);
    try {
      await addArticle({
        name: name.trim(),
        bestand: toInt(bestand),
        mindestbestand: toInt(mindest),
        einheit: einheit.trim() || null,
        lieferant: lieferant.trim() || null,
      });
    } catch {
      setFehler("Hinzufügen fehlgeschlagen.");
      return;
    }
    onSaved();
    setName(""); setBestand(""); setMindest(""); setEinheit(""); setLieferant("");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">Name</span>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Startbestand</span>
          <input aria-label="Startbestand" type="number" min={0} value={bestand}
            onChange={(e) => setBestand(e.target.value)} className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Mindestbestand</span>
          <input aria-label="Mindestbestand" type="number" min={0} value={mindest}
            onChange={(e) => setMindest(e.target.value)} className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Einheit</span>
          <input aria-label="Einheit" value={einheit} onChange={(e) => setEinheit(e.target.value)}
            placeholder="Stk, kg …" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Lieferant</span>
          <input aria-label="Lieferant" value={lieferant} onChange={(e) => setLieferant(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
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

- [ ] **Step 4: Run → PASS**

Run: `npm test -- ArticleForm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/ArticleForm.tsx src/features/inventory/ArticleForm.test.tsx
git commit -m "feat(lager): article entry form"
```

---

## Task 5: ArticleRow + ArticleList — TDD

**Files:** Create `src/features/inventory/ArticleRow.tsx`, `src/features/inventory/ArticleList.tsx` + ArticleList test

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/features/inventory/ArticleList.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Article } from "@/lib/db/articles";
import { setBestand, deleteArticle } from "@/lib/db/articles";

const sample: Article[] = [
  { id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" },
  { id: 2, name: "Zucker", bestand: 2, mindestbestand: 4, einheit: "kg", lieferant: "Hofer" },
];
vi.mock("@/lib/db/articles", () => ({
  listArticles: vi.fn(async () => sample),
  setBestand: vi.fn(async () => {}),
  deleteArticle: vi.fn(async () => {}),
}));

import { ArticleList } from "./ArticleList";

describe("ArticleList", () => {
  it("lists articles, marks low stock, filters, increments and deletes", async () => {
    render(<ArticleList reloadKey={0} />);
    expect(await screen.findByText("Mehl")).toBeInTheDocument();
    // Zucker (2 <= 4) ist low-stock -> genau eine „nachbestellen"-Markierung (Mehl 5>3 nicht)
    expect(screen.getByText(/nachbestellen/i)).toBeInTheDocument();
    // + erhöht Mehl von 5 auf 6
    await userEvent.click(screen.getByRole("button", { name: /Mehl Bestand erhöhen/i }));
    expect(vi.mocked(setBestand)).toHaveBeenCalledWith(1, 6);
    // löschen
    await userEvent.click(screen.getByRole("button", { name: /Mehl löschen/i }));
    expect(vi.mocked(deleteArticle)).toHaveBeenCalledWith(1);
    // filtern
    await userEvent.type(screen.getByLabelText(/suchen/i), "zucker");
    expect(screen.queryByText("Mehl")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- inventory/ArticleList`
Expected: FAIL.

- [ ] **Step 3: ArticleRow implementieren**

Create `src/features/inventory/ArticleRow.tsx`:
```tsx
import type { Article } from "@/lib/db/articles";
import { isLowStock } from "./articleFilter";
import { cn } from "@/lib/utils";

interface ArticleRowProps {
  article: Article;
  onSetBestand: (id: number, bestand: number) => void;
  onDelete: (id: number) => void;
}

export function ArticleRow({ article, onSetBestand, onDelete }: ArticleRowProps) {
  const low = isLowStock(article);
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border bg-card px-4 py-3",
      low ? "border-red-400" : "border-border",
    )}>
      <div className="flex flex-col">
        <span className="font-medium">{article.name}</span>
        {low && <span className="mt-0.5 w-fit rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">nachbestellen</span>}
        <span className="text-sm text-muted-foreground">
          Mindest {article.mindestbestand}{article.einheit ? ` ${article.einheit}` : ""}
          {article.lieferant ? ` · ${article.lieferant}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${article.name} Bestand verringern`}
          onClick={() => onSetBestand(article.id, Math.max(0, article.bestand - 1))}
          className="h-8 w-8 rounded-lg border border-border">−</button>
        <input aria-label={`${article.name} Bestand`} type="number" min={0} value={article.bestand}
          onChange={(e) => onSetBestand(article.id, Math.max(0, Math.floor(Number(e.target.value)) || 0))}
          className="w-16 rounded-lg border border-border px-2 py-1 text-right" />
        <button type="button" aria-label={`${article.name} Bestand erhöhen`}
          onClick={() => onSetBestand(article.id, article.bestand + 1)}
          className="h-8 w-8 rounded-lg border border-border">+</button>
        {article.einheit && <span className="w-8 text-sm text-muted-foreground">{article.einheit}</span>}
        <button type="button" aria-label={`${article.name} löschen`} onClick={() => onDelete(article.id)}
          className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
          Löschen
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: ArticleList implementieren**

Create `src/features/inventory/ArticleList.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listArticles, setBestand, deleteArticle, type Article } from "@/lib/db/articles";
import { filterArticles } from "./articleFilter";
import { ArticleRow } from "./ArticleRow";

export function ArticleList({ reloadKey }: { reloadKey: number }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    setArticles(await listArticles());
  }
  useEffect(() => { reload(); }, [reloadKey]);

  async function changeBestand(id: number, bestand: number) {
    try {
      await setBestand(id, bestand);
      setFehler(null);
      await reload();
    } catch {
      setFehler("Bestand konnte nicht gespeichert werden.");
    }
  }

  async function remove(id: number) {
    try {
      await deleteArticle(id);
      setFehler(null);
      await reload();
    } catch {
      setFehler("Löschen fehlgeschlagen.");
    }
  }

  const shown = filterArticles(articles, query);

  return (
    <div className="space-y-4">
      <input aria-label="Suchen" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Suchen (Name, Lieferant)…"
        className="w-full rounded-xl border border-border px-3 py-2" />
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {shown.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Artikel.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((a) => (
            <ArticleRow key={a.id} article={a} onSetBestand={changeBestand} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run → PASS**

Run: `npm test -- inventory/ArticleList`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/inventory/ArticleRow.tsx src/features/inventory/ArticleList.tsx src/features/inventory/ArticleList.test.tsx
git commit -m "feat(lager): article row + list (stock +/-, low-stock, search, delete)"
```

---

## Task 6: InventoryModule + Route — TDD

**Files:** Create `src/routes/inventory/InventoryModule.tsx` + test; modify `src/App.tsx`; delete `src/routes/modules/InventoryPlaceholder.tsx`

- [ ] **Step 1: Failing Test (DB gemockt)**

Create `src/routes/inventory/InventoryModule.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/db/articles", () => ({
  listArticles: vi.fn(async () => []),
  addArticle: vi.fn(async () => {}),
  setBestand: vi.fn(async () => {}),
  deleteArticle: vi.fn(async () => {}),
}));

import { InventoryModule } from "./InventoryModule";

describe("InventoryModule", () => {
  it("shows the Artikel tab by default and a back link", async () => {
    render(<MemoryRouter><InventoryModule /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /artikel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hinzufügen/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine artikel/i)).toBeInTheDocument();
  });

  it("switches to the Bestellung placeholder tab", async () => {
    render(<MemoryRouter><InventoryModule /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /bestellung/i }));
    expect(screen.getByText(/bald verfügbar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- InventoryModule`
Expected: FAIL.

- [ ] **Step 3: InventoryModule implementieren**

Create `src/routes/inventory/InventoryModule.tsx`:
```tsx
import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { ArticleForm } from "@/features/inventory/ArticleForm";
import { ArticleList } from "@/features/inventory/ArticleList";

type Tab = "artikel" | "bestellung";

const TABS: { id: Tab; label: string }[] = [
  { id: "artikel", label: "Artikel" },
  { id: "bestellung", label: "Bestellung" },
];

export function InventoryModule() {
  const [tab, setTab] = useState<Tab>("artikel");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <BackLink />
      <h1 className="mb-6 text-2xl font-bold text-foreground">Lager</h1>
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

      {tab === "artikel" && (
        <div className="space-y-6">
          <ArticleForm onSaved={() => setReloadKey((k) => k + 1)} />
          <ArticleList reloadKey={reloadKey} />
        </div>
      )}
      {tab === "bestellung" && <p className="text-muted-foreground">Bestellung — bald verfügbar.</p>}
    </main>
  );
}
```

- [ ] **Step 4: Route umstellen**

In `src/App.tsx` den Import `InventoryPlaceholder` entfernen und ersetzen:
```tsx
import { InventoryModule } from "@/routes/inventory/InventoryModule";
```
und die Route ändern:
```tsx
      <Route path="/inventory" element={<InventoryModule />} />
```
Die Datei `src/routes/modules/InventoryPlaceholder.tsx` löschen.

- [ ] **Step 5: Run → PASS**

Run: `npm test -- InventoryModule`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lager): inventory module tabs, wire /inventory route"
```

---

## Task 7: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build** (Exit-Code prüfen, NICHT durch `tail` pipen)

Run: `npm test` → alle grün.
Run: `npm run build` → keine TS-Fehler.

- [ ] **Step 2: Rust-Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -3`
Expected: ohne Fehler (Migration v4 kompiliert).

- [ ] **Step 3: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.7.0 -m "v0.7.0 — Lager (Artikel-Verwaltung)"
git push --follow-tags
```

---

## Definition of Done

- `/inventory` zeigt das Lager-Modul mit Tabs **Artikel** (nutzbar) und **Bestellung**
  (Platzhalter) + Zurück-zum-Cockpit-Link.
- Artikel anlegen (Name Pflicht, optional Bestand/Mindest/Einheit/Lieferant); Liste mit
  Bestand **+/−** und Direkteingabe (nie < 0); Artikel ≤ Mindestbestand markiert
  („… nachbestellen"); **Suchen** (Name/Lieferant); **Löschen**.
- Migration v4 legt `articles` an.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo build` sauber.
- Stand getaggt **`v0.7.0`** und gepusht.

## Bewusst NICHT in v1

- Bestell-/Nachbestell-Reiter (gruppiert nach Lieferant) + Export — eigener Folgeplan.
- Artikel bearbeiten (Name/Lieferant ändern) — bei Bedarf später; v1 = Bestand pflegen + löschen.
