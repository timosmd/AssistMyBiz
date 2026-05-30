# Tageskasse 2a — Datenmodell + Belege — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Belege im Laden-Cockpit lokal erfassen und verwalten: SQLite-Schema (Kategorien + Belege), Geld-Helfer, typisierter Datenzugriff, robustes Datei-Handling (Import per PC in einen verwalteten App-Ordner) und die komplette Belege-UI (Erfassen, Liste, Suchen/Filtern, Ansehen, Löschen) unter `/till`.

**Architecture:** Aufbau auf der bestehenden Tauri-2-App. Dateien werden in **Rust** in den App-Datenordner kopiert/gelesen (umgeht heikle Webview-Dateiscopes); das Frontend ruft diese per `invoke()`. Geschäftslogik (Cent-Mathematik, Datei-Benennung) liegt in **reinen, getesteten Funktionen**. Datenzugriff kapselt SQL hinter `src/lib/db/*`. UI in kleinen `src/features/receipts/*`-Einheiten unter einer Tab-Hülle `TillModule`.

**Tech Stack:** Tauri 2 (Rust), `tauri-plugin-sql` (SQLite), `tauri-plugin-dialog` (Datei-Auswahl), React 19 + TypeScript, Tailwind/shadcn, Vitest + Testing Library.

---

## File Structure (angelegt/geändert in diesem Plan)

```
src-tauri/
  src/lib.rs                       # Migration v2 registrieren; receipts-Commands registrieren
  src/receipts.rs                  # NEU: import_receipt_file / read_receipt_file (+ reine Helfer + Rust-Tests)
  capabilities/default.json        # dialog-Permissions ergänzen
  Cargo.toml                       # tauri-plugin-dialog, uuid
src/
  lib/money.ts                     # NEU: Cent<->Euro, Formatierung (rein)
  lib/money.test.ts
  lib/db/categories.ts             # NEU: listCategories, addCategory
  lib/db/categories.test.ts
  lib/db/receipts.ts               # NEU: addReceipt, listReceipts(filter), getReceipt, deleteReceipt
  lib/db/receipts.test.ts
  features/receipts/ReceiptForm.tsx        # NEU: Erfassen (Felder + Datei) + Validierung
  features/receipts/ReceiptForm.test.tsx
  features/receipts/ReceiptCard.tsx        # NEU: ein Beleg in der Liste
  features/receipts/ReceiptList.tsx        # NEU: Liste + Suchen/Filtern
  features/receipts/ReceiptList.test.tsx
  features/receipts/filter.ts              # NEU: reine Filter-Funktion
  features/receipts/filter.test.ts
  routes/till/TillModule.tsx       # NEU: Tab-Hülle (Belege aktiv; Tageskasse/Auswertung „bald")
  routes/till/TillModule.test.tsx
  App.tsx                          # /till -> TillModule statt TillPlaceholder
```

---

## Task 1: Plugins & Migration v2 (Kategorien + Belege)

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Install: `@tauri-apps/plugin-dialog`

- [ ] **Step 1: Dialog-Plugin (JS) installieren**

Run: `npm install @tauri-apps/plugin-dialog`

- [ ] **Step 2: Rust-Abhängigkeiten ergänzen**

In `src-tauri/Cargo.toml` unter `[dependencies]` ergänzen:
```toml
tauri-plugin-dialog = "2"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 3: Migration v2 + Dialog-Plugin in `lib.rs` registrieren**

In `src-tauri/src/lib.rs` den vorhandenen `migrations`-Vektor um eine zweite Migration ergänzen (die bestehende v1 NICHT ändern) und das Dialog-Plugin in die Builder-Kette aufnehmen. Die `migrations`-Liste sieht danach so aus:
```rust
let migrations = vec![
    Migration {
        version: 1,
        description: "create_settings_table",
        sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "create_receipts_and_categories",
        sql: "
            CREATE TABLE categories (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              is_default INTEGER NOT NULL DEFAULT 0,
              sort_order INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO categories (name, is_default, sort_order) VALUES
              ('Wareneinkauf', 1, 1),
              ('Miete', 1, 2),
              ('Betriebskosten', 1, 3),
              ('Büromaterial', 1, 4),
              ('Marketing', 1, 5),
              ('Sonstiges', 1, 6);
            CREATE TABLE receipts (
              id INTEGER PRIMARY KEY,
              datum TEXT NOT NULL,
              betrag_cent INTEGER NOT NULL,
              kategorie_id INTEGER REFERENCES categories(id),
              notiz TEXT,
              datei_pfad TEXT,
              datei_typ TEXT,
              erstellt_am TEXT NOT NULL
            );
        ",
        kind: MigrationKind::Up,
    },
];
```
Und das Dialog-Plugin registrieren (zusätzlich zu den bestehenden `.plugin(...)`-Aufrufen):
```rust
        .plugin(tauri_plugin_dialog::init())
```

- [ ] **Step 4: Dialog-Permission freischalten**

In `src-tauri/capabilities/default.json` im `permissions`-Array ergänzen (bestehende behalten):
```json
"dialog:default",
"dialog:allow-open"
```

- [ ] **Step 5: Rust kompiliert**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -5`
Expected: `Finished` ohne Fehler (lädt tauri-plugin-dialog + uuid). NICHT `npm run tauri dev` (blockiert mit GUI-Fenster).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(till): migration v2 (categories+receipts) and dialog plugin"
```

---

## Task 2: Geld-Helfer (reine Funktionen) — TDD

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/lib/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { euroToCents, centsToEuroString, formatEuro } from "./money";

describe("euroToCents", () => {
  it("parses comma and dot decimals to integer cents", () => {
    expect(euroToCents("12,34")).toBe(1234);
    expect(euroToCents("12.34")).toBe(1234);
    expect(euroToCents("5")).toBe(500);
    expect(euroToCents("0,09")).toBe(9);
  });
  it("returns null for invalid input", () => {
    expect(euroToCents("abc")).toBeNull();
    expect(euroToCents("")).toBeNull();
  });
});

describe("centsToEuroString", () => {
  it("formats cents as a plain editable euro string with comma", () => {
    expect(centsToEuroString(1234)).toBe("12,34");
    expect(centsToEuroString(9)).toBe("0,09");
  });
});

describe("formatEuro", () => {
  it("formats cents as a localized euro amount", () => {
    expect(formatEuro(1234)).toBe("12,34 €");
    expect(formatEuro(0)).toBe("0,00 €");
  });
});
```

- [ ] **Step 2: Test ausführen → FAIL**

Run: `npm test -- money`
Expected: FAIL („Cannot find module './money'").

- [ ] **Step 3: Implementierung**

Create `src/lib/money.ts`:
```ts
/** Parst einen Euro-String (Komma oder Punkt) in ganze Cent. Null bei Unsinn. */
export function euroToCents(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed === "" || !/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(parseFloat(trimmed) * 100);
}

/** Cent als editierbarer Euro-String mit Komma, immer zwei Nachkommastellen. */
export function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Cent als angezeigter Betrag „12,34 €" (de-AT). */
export function formatEuro(cents: number): string {
  return (
    new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      cents / 100,
    ) + " €"
  );
}
```

- [ ] **Step 4: Test ausführen → PASS**

Run: `npm test -- money`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat(till): money helpers (euro<->cents, format)"
```

---

## Task 3: Kategorien-Datenzugriff — TDD

**Files:**
- Create: `src/lib/db/categories.ts`
- Test: `src/lib/db/categories.test.ts`

- [ ] **Step 1: Failing Test (SQL gemockt)**

Create `src/lib/db/categories.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listCategories, addCategory } from "./categories";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("listCategories", () => {
  it("returns categories ordered by sort_order", async () => {
    select.mockResolvedValue([
      { id: 1, name: "Wareneinkauf", is_default: 1, sort_order: 1 },
      { id: 6, name: "Sonstiges", is_default: 1, sort_order: 6 },
    ]);
    const cats = await listCategories();
    expect(cats).toHaveLength(2);
    expect(cats[0]).toEqual({ id: 1, name: "Wareneinkauf", isDefault: true, sortOrder: 1 });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY sort_order/i);
  });
});

describe("addCategory", () => {
  it("inserts a custom category at the end", async () => {
    execute.mockResolvedValue(undefined);
    await addCategory("Verpackung");
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO categories/i);
    expect(params[0]).toBe("Verpackung");
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- categories`
Expected: FAIL („Cannot find module './categories'").

- [ ] **Step 3: Implementierung**

Create `src/lib/db/categories.ts`:
```ts
import Database from "@tauri-apps/plugin-sql";

export interface Category {
  id: number;
  name: string;
  isDefault: boolean;
  sortOrder: number;
}

let dbPromise: Promise<Database> | null = null;
function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:assistmybiz.db");
  return dbPromise;
}

interface CategoryRow {
  id: number;
  name: string;
  is_default: number;
  sort_order: number;
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT id, name, is_default, sort_order FROM categories ORDER BY sort_order, name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.is_default === 1,
    sortOrder: r.sort_order,
  }));
}

export async function addCategory(name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO categories (name, is_default, sort_order) VALUES ($1, 0, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories))",
    [name],
  );
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- categories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/categories.ts src/lib/db/categories.test.ts
git commit -m "feat(till): category data access (list/add)"
```

---

## Task 4: Belege-Datenzugriff — TDD

**Files:**
- Create: `src/lib/db/receipts.ts`
- Test: `src/lib/db/receipts.test.ts`

- [ ] **Step 1: Failing Test (SQL gemockt)**

Create `src/lib/db/receipts.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { addReceipt, listReceipts, deleteReceipt } from "./receipts";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("addReceipt", () => {
  it("inserts a receipt with cents and the given fields", async () => {
    execute.mockResolvedValue(undefined);
    await addReceipt({
      datum: "2026-05-31",
      betragCent: 1234,
      kategorieId: 1,
      notiz: "Bäcker",
      dateiPfad: "2026/abc.jpg",
      dateiTyp: "jpg",
    });
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO receipts/i);
    expect(params.slice(0, 6)).toEqual(["2026-05-31", 1234, 1, "Bäcker", "2026/abc.jpg", "jpg"]);
  });
});

describe("listReceipts", () => {
  it("maps rows and joins the category name", async () => {
    select.mockResolvedValue([
      {
        id: 7,
        datum: "2026-05-31",
        betrag_cent: 1234,
        kategorie_id: 1,
        kategorie_name: "Wareneinkauf",
        notiz: "Bäcker",
        datei_pfad: "2026/abc.jpg",
        datei_typ: "jpg",
      },
    ]);
    const list = await listReceipts();
    expect(list[0]).toEqual({
      id: 7,
      datum: "2026-05-31",
      betragCent: 1234,
      kategorieId: 1,
      kategorieName: "Wareneinkauf",
      notiz: "Bäcker",
      dateiPfad: "2026/abc.jpg",
      dateiTyp: "jpg",
    });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY datum DESC/i);
  });
});

describe("deleteReceipt", () => {
  it("deletes by id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteReceipt(7);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM receipts WHERE id = \$1/i);
    expect(params).toEqual([7]);
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- receipts`
Expected: FAIL („Cannot find module './receipts'").

- [ ] **Step 3: Implementierung**

Create `src/lib/db/receipts.ts`:
```ts
import Database from "@tauri-apps/plugin-sql";

export interface NewReceipt {
  datum: string;
  betragCent: number;
  kategorieId: number | null;
  notiz: string | null;
  dateiPfad: string | null;
  dateiTyp: string | null;
}

export interface Receipt extends NewReceipt {
  id: number;
  kategorieName: string | null;
}

let dbPromise: Promise<Database> | null = null;
function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:assistmybiz.db");
  return dbPromise;
}

interface ReceiptRow {
  id: number;
  datum: string;
  betrag_cent: number;
  kategorie_id: number | null;
  kategorie_name: string | null;
  notiz: string | null;
  datei_pfad: string | null;
  datei_typ: string | null;
}

export async function addReceipt(r: NewReceipt): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO receipts (datum, betrag_cent, kategorie_id, notiz, datei_pfad, datei_typ, erstellt_am)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [r.datum, r.betragCent, r.kategorieId, r.notiz, r.dateiPfad, r.dateiTyp, new Date().toISOString()],
  );
}

export async function listReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.select<ReceiptRow[]>(
    `SELECT r.id, r.datum, r.betrag_cent, r.kategorie_id, c.name AS kategorie_name,
            r.notiz, r.datei_pfad, r.datei_typ
       FROM receipts r LEFT JOIN categories c ON c.id = r.kategorie_id
      ORDER BY datum DESC, r.id DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    betragCent: r.betrag_cent,
    kategorieId: r.kategorie_id,
    kategorieName: r.kategorie_name,
    notiz: r.notiz,
    dateiPfad: r.datei_pfad,
    dateiTyp: r.datei_typ,
  }));
}

export async function deleteReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM receipts WHERE id = $1", [id]);
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- receipts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/receipts.ts src/lib/db/receipts.test.ts
git commit -m "feat(till): receipt data access (add/list/delete)"
```

---

## Task 5: Rust-Datei-Handling (Import/Read) — TDD

**Files:**
- Create: `src-tauri/src/receipts.rs`
- Modify: `src-tauri/src/lib.rs` (Modul + Commands registrieren)

- [ ] **Step 1: Reine Helfer + Rust-Test schreiben**

Create `src-tauri/src/receipts.rs`:
```rust
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Erlaubte Dateiendung -> normalisierter Typ. None = nicht erlaubt.
pub fn file_kind(src: &str) -> Option<&'static str> {
    match Path::new(src).extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => Some("jpg"),
        Some("png") => Some("png"),
        Some("pdf") => Some("pdf"),
        _ => None,
    }
}

/// Relativer Zielpfad innerhalb von receipts/: "<jahr>/<uuid>.<kind>".
pub fn relative_dest(year: &str, uuid: &str, kind: &str) -> String {
    format!("{year}/{uuid}.{kind}")
}

#[derive(serde::Serialize)]
pub struct ImportedFile {
    pub relative_path: String,
    pub file_kind: String,
}

#[tauri::command]
pub fn import_receipt_file(app: tauri::AppHandle, src_path: String, year: String) -> Result<ImportedFile, String> {
    let kind = file_kind(&src_path).ok_or_else(|| "Nicht unterstützter Dateityp".to_string())?;
    let uuid = uuid::Uuid::new_v4().to_string();
    let rel = relative_dest(&year, &uuid, kind);
    let base: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts");
    let dest = base.join(&rel);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::copy(&src_path, &dest).map_err(|e| e.to_string())?;
    Ok(ImportedFile { relative_path: rel, file_kind: kind.to_string() })
}

#[tauri::command]
pub fn read_receipt_file(app: tauri::AppHandle, relative_path: String) -> Result<Vec<u8>, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts").join(&relative_path);
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_kind_normalizes_known_extensions() {
        assert_eq!(file_kind("a/b/foo.JPG"), Some("jpg"));
        assert_eq!(file_kind("foo.jpeg"), Some("jpg"));
        assert_eq!(file_kind("foo.PNG"), Some("png"));
        assert_eq!(file_kind("foo.pdf"), Some("pdf"));
        assert_eq!(file_kind("foo.gif"), None);
        assert_eq!(file_kind("noext"), None);
    }
    #[test]
    fn relative_dest_builds_year_uuid_kind() {
        assert_eq!(relative_dest("2026", "abc", "jpg"), "2026/abc.jpg");
    }
}
```

- [ ] **Step 2: Modul + Commands in `lib.rs` registrieren**

In `src-tauri/src/lib.rs` oben ergänzen:
```rust
mod receipts;
```
und den `invoke_handler` um die zwei Commands erweitern (bestehende Handler behalten):
```rust
        .invoke_handler(tauri::generate_handler![
            receipts::import_receipt_file,
            receipts::read_receipt_file
        ])
```
(Falls bereits ein `generate_handler!` mit z. B. `greet` existiert, die neuen Einträge dort ergänzen.)

- [ ] **Step 3: Rust-Tests + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -15`
Expected: die zwei `receipts`-Tests PASS, Build ohne Fehler.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/receipts.rs src-tauri/src/lib.rs
git commit -m "feat(till): rust commands to import/read receipt files"
```

---

## Task 6: Reine Filter-Funktion für Belege — TDD

**Files:**
- Create: `src/features/receipts/filter.ts`
- Test: `src/features/receipts/filter.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/receipts/filter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { filterReceipts } from "./filter";
import type { Receipt } from "@/lib/db/receipts";

const base: Receipt = {
  id: 1, datum: "2026-05-31", betragCent: 1000, kategorieId: 1,
  kategorieName: "Wareneinkauf", notiz: "Bäcker Müller", dateiPfad: null, dateiTyp: null,
};
const list: Receipt[] = [
  base,
  { ...base, id: 2, kategorieId: 2, kategorieName: "Miete", notiz: "Mai" },
];

describe("filterReceipts", () => {
  it("returns all when query empty and category null", () => {
    expect(filterReceipts(list, "", null)).toHaveLength(2);
  });
  it("filters by case-insensitive text in note or category", () => {
    expect(filterReceipts(list, "bäcker", null).map((r) => r.id)).toEqual([1]);
    expect(filterReceipts(list, "miete", null).map((r) => r.id)).toEqual([2]);
  });
  it("filters by category id", () => {
    expect(filterReceipts(list, "", 2).map((r) => r.id)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- receipts/filter`
Expected: FAIL.

- [ ] **Step 3: Implementierung**

Create `src/features/receipts/filter.ts`:
```ts
import type { Receipt } from "@/lib/db/receipts";

export function filterReceipts(
  receipts: Receipt[],
  query: string,
  categoryId: number | null,
): Receipt[] {
  const q = query.trim().toLowerCase();
  return receipts.filter((r) => {
    if (categoryId !== null && r.kategorieId !== categoryId) return false;
    if (q === "") return true;
    const haystack = `${r.notiz ?? ""} ${r.kategorieName ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- receipts/filter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/filter.ts src/features/receipts/filter.test.ts
git commit -m "feat(till): pure receipt filter function"
```

---

## Task 7: ReceiptForm (Erfassen) — TDD

**Files:**
- Create: `src/features/receipts/ReceiptForm.tsx`
- Test: `src/features/receipts/ReceiptForm.test.tsx`

- [ ] **Step 1: Failing Test (Validierung + Speichern; Tauri/DB gemockt)**

Create `src/features/receipts/ReceiptForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addReceipt = vi.fn();
vi.mock("@/lib/db/receipts", () => ({ addReceipt: (...a: unknown[]) => addReceipt(...a) }));
vi.mock("@/lib/db/categories", () => ({
  listCategories: vi.fn(async () => [{ id: 1, name: "Wareneinkauf", isDefault: true, sortOrder: 1 }]),
}));

import { ReceiptForm } from "./ReceiptForm";

beforeEach(() => addReceipt.mockReset());

describe("ReceiptForm", () => {
  it("blocks saving when the amount is empty/invalid", async () => {
    render(<ReceiptForm onSaved={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /speichern/i }));
    expect(addReceipt).not.toHaveBeenCalled();
    expect(screen.getByText(/gültigen betrag/i)).toBeInTheDocument();
  });

  it("saves a receipt with parsed cents", async () => {
    addReceipt.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<ReceiptForm onSaved={onSaved} />);
    await userEvent.type(await screen.findByLabelText(/betrag/i), "12,34");
    await userEvent.click(screen.getByRole("button", { name: /speichern/i }));
    expect(addReceipt).toHaveBeenCalledTimes(1);
    expect(addReceipt.mock.calls[0][0].betragCent).toBe(1234);
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- ReceiptForm`
Expected: FAIL („Cannot find module './ReceiptForm'").

- [ ] **Step 3: Implementierung**

Create `src/features/receipts/ReceiptForm.tsx`:
```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { addReceipt } from "@/lib/db/receipts";
import { listCategories, type Category } from "@/lib/db/categories";
import { euroToCents } from "@/lib/money";

interface ImportedFile { relative_path: string; file_kind: string; }

export function ReceiptForm({ onSaved }: { onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [betrag, setBetrag] = useState("");
  const [kategorieId, setKategorieId] = useState<number | null>(null);
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [datei, setDatei] = useState<ImportedFile | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    listCategories().then((cs) => {
      setCategories(cs);
      const sonstiges = cs.find((c) => c.name === "Sonstiges") ?? cs[0];
      if (sonstiges) setKategorieId(sonstiges.id);
    });
  }, []);

  async function pickFile() {
    const path = await open({
      multiple: false,
      filters: [{ name: "Beleg", extensions: ["jpg", "jpeg", "png", "pdf"] }],
    });
    if (typeof path !== "string") return;
    const year = datum.slice(0, 4);
    const imported = await invoke<ImportedFile>("import_receipt_file", { srcPath: path, year });
    setDatei(imported);
  }

  async function save() {
    const cents = euroToCents(betrag);
    if (cents === null) {
      setFehler("Bitte einen gültigen Betrag eingeben (z. B. 12,34).");
      return;
    }
    setFehler(null);
    await addReceipt({
      datum,
      betragCent: cents,
      kategorieId,
      notiz: notiz.trim() || null,
      dateiPfad: datei?.relative_path ?? null,
      dateiTyp: datei?.file_kind ?? null,
    });
    onSaved();
    setBetrag(""); setNotiz(""); setDatei(null);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Betrag (€)</span>
          <input aria-label="Betrag" value={betrag} onChange={(e) => setBetrag(e.target.value)}
            inputMode="decimal" placeholder="12,34"
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Datum</span>
          <input aria-label="Datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Kategorie</span>
          <select aria-label="Kategorie" value={kategorieId ?? ""}
            onChange={(e) => setKategorieId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-xl border border-border px-3 py-2">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notiz</span>
          <input aria-label="Notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={pickFile}
          className="rounded-xl border border-border px-4 py-2 text-sm">
          {datei ? `Beleg: ${datei.file_kind.toUpperCase()} ✓` : "Datei wählen"}
        </button>
        <button type="button" onClick={save}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Speichern
        </button>
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- ReceiptForm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/ReceiptForm.tsx src/features/receipts/ReceiptForm.test.tsx
git commit -m "feat(till): receipt entry form with file import"
```

---

## Task 8: ReceiptCard + ReceiptList (Liste, Suchen/Filtern, Löschen) — TDD

**Files:**
- Create: `src/features/receipts/ReceiptCard.tsx`, `src/features/receipts/ReceiptList.tsx`
- Test: `src/features/receipts/ReceiptList.test.tsx`

- [ ] **Step 1: Failing Test (Liste rendert, Filter wirkt; DB gemockt)**

Create `src/features/receipts/ReceiptList.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Receipt } from "@/lib/db/receipts";

const sample: Receipt[] = [
  { id: 1, datum: "2026-05-31", betragCent: 1000, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: "Bäcker", dateiPfad: null, dateiTyp: null },
  { id: 2, datum: "2026-05-30", betragCent: 2000, kategorieId: 2, kategorieName: "Miete", notiz: "Mai", dateiPfad: null, dateiTyp: null },
];
vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => sample),
  deleteReceipt: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/categories", () => ({
  listCategories: vi.fn(async () => [
    { id: 1, name: "Wareneinkauf", isDefault: true, sortOrder: 1 },
    { id: 2, name: "Miete", isDefault: true, sortOrder: 2 },
  ]),
}));

import { ReceiptList } from "./ReceiptList";

describe("ReceiptList", () => {
  it("renders all receipts and filters by search text", async () => {
    render(<ReceiptList reloadKey={0} />);
    expect(await screen.findByText("Bäcker")).toBeInTheDocument();
    expect(screen.getByText("Mai")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/suchen/i), "bäcker");
    expect(screen.getByText("Bäcker")).toBeInTheDocument();
    expect(screen.queryByText("Mai")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- ReceiptList`
Expected: FAIL.

- [ ] **Step 3: ReceiptCard implementieren**

Create `src/features/receipts/ReceiptCard.tsx`:
```tsx
import type { Receipt } from "@/lib/db/receipts";
import { formatEuro } from "@/lib/money";

export function ReceiptCard({ receipt, onDelete }: { receipt: Receipt; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col">
        <span className="font-medium">{receipt.notiz || receipt.kategorieName || "Beleg"}</span>
        <span className="text-sm text-muted-foreground">
          {receipt.datum} · {receipt.kategorieName ?? "—"}
          {receipt.dateiTyp ? ` · ${receipt.dateiTyp.toUpperCase()}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{formatEuro(receipt.betragCent)}</span>
        <button type="button" aria-label={`Beleg ${receipt.id} löschen`}
          onClick={() => onDelete(receipt.id)}
          className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
          Löschen
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: ReceiptList implementieren**

Create `src/features/receipts/ReceiptList.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listReceipts, deleteReceipt, type Receipt } from "@/lib/db/receipts";
import { listCategories, type Category } from "@/lib/db/categories";
import { filterReceipts } from "./filter";
import { ReceiptCard } from "./ReceiptCard";

export function ReceiptList({ reloadKey }: { reloadKey: number }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  async function reload() {
    setReceipts(await listReceipts());
  }
  useEffect(() => { reload(); }, [reloadKey]);
  useEffect(() => { listCategories().then(setCategories); }, []);

  async function remove(id: number) {
    await deleteReceipt(id);
    await reload();
  }

  const shown = filterReceipts(receipts, query, categoryId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input aria-label="Suchen" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen (Notiz, Kategorie)…"
          className="flex-1 rounded-xl border border-border px-3 py-2" />
        <select aria-label="Kategorie-Filter" value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-xl border border-border px-3 py-2">
          <option value="">Alle Kategorien</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Belege.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => <ReceiptCard key={r.id} receipt={r} onDelete={remove} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Test → PASS**

Run: `npm test -- ReceiptList`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/receipts/ReceiptCard.tsx src/features/receipts/ReceiptList.tsx src/features/receipts/ReceiptList.test.tsx
git commit -m "feat(till): receipt list with search/filter and delete"
```

---

## Task 9: TillModule (Tab-Hülle) + Route — TDD

**Files:**
- Create: `src/routes/till/TillModule.tsx`
- Test: `src/routes/till/TillModule.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Failing Test (Tabs; Belege aktiv; Erfassen lädt Liste neu)**

Create `src/routes/till/TillModule.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => []),
  deleteReceipt: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/categories", () => ({ listCategories: vi.fn(async () => []) }));

import { TillModule } from "./TillModule";

describe("TillModule", () => {
  it("shows three tabs and the Belege tab by default", async () => {
    render(<TillModule />);
    expect(screen.getByRole("tab", { name: /belege/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tageskasse/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /auswertung/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine belege/i)).toBeInTheDocument();
  });

  it("switches to the Tageskasse tab placeholder", async () => {
    render(<TillModule />);
    await userEvent.click(screen.getByRole("tab", { name: /tageskasse/i }));
    expect(screen.getByText(/bald verfügbar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- TillModule`
Expected: FAIL.

- [ ] **Step 3: TillModule implementieren**

Create `src/routes/till/TillModule.tsx`:
```tsx
import { useState } from "react";
import { ReceiptForm } from "@/features/receipts/ReceiptForm";
import { ReceiptList } from "@/features/receipts/ReceiptList";

type Tab = "belege" | "tageskasse" | "auswertung";

const TABS: { id: Tab; label: string }[] = [
  { id: "belege", label: "Belege" },
  { id: "tageskasse", label: "Tageskasse" },
  { id: "auswertung", label: "Auswertung" },
];

export function TillModule() {
  const [tab, setTab] = useState<Tab>("belege");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Tageskasse &amp; Belege</h1>
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

      {tab === "belege" && (
        <div className="space-y-6">
          <ReceiptForm onSaved={() => setReloadKey((k) => k + 1)} />
          <ReceiptList reloadKey={reloadKey} />
        </div>
      )}
      {tab === "tageskasse" && <p className="text-muted-foreground">Tageskasse — bald verfügbar.</p>}
      {tab === "auswertung" && <p className="text-muted-foreground">Auswertung — bald verfügbar.</p>}
    </main>
  );
}
```

- [ ] **Step 4: Route umstellen**

In `src/App.tsx` den Import `TillPlaceholder` entfernen und durch `TillModule` ersetzen:
```tsx
import { TillModule } from "@/routes/till/TillModule";
```
und die Route ändern:
```tsx
      <Route path="/till" element={<TillModule />} />
```
Die Datei `src/routes/modules/TillPlaceholder.tsx` löschen (wird nicht mehr referenziert).

- [ ] **Step 5: Test → PASS**

Run: `npm test -- TillModule`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(till): tabbed module shell, wire /till route to Belege"
```

---

## Task 10: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest (Frontend) + Build**

Run: `npm test`
Expected: alle Tests grün (inkl. money, categories, receipts, filter, ReceiptForm, ReceiptList, TillModule, plus bestehende).
Run: `npm run build`
Expected: keine TS-Fehler.

- [ ] **Step 2: Rust-Test + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -8 && cargo build 2>&1 | tail -3`
Expected: receipts-Tests grün, Build ohne Fehler.

- [ ] **Step 3: Tag setzen & pushen** (Projekt-Workflow: immer mit Versions-Tag)

```bash
git tag -a v0.3.0 -m "v0.3.0 — Belege (Tageskasse-Modul 2a)"
git push --follow-tags
```
Expected: Branch + Tag `v0.3.0` auf `origin`.

---

## Definition of Done

- `/till` zeigt das Modul mit drei Tabs; **Belege** ist nutzbar:
  - Beleg erfassen mit Betrag (Pflicht, Komma-Parsing), Kategorie (Default „Sonstiges"), Datum (Default heute), Notiz, optional Datei (jpg/png/pdf) per Datei-Dialog.
  - Datei wird per Rust in `<AppData>/receipts/<jahr>/<uuid>.<ext>` kopiert; relativer Pfad in der DB.
  - Liste zeigt Belege (neueste zuerst), **Suchen** (Notiz/Kategorie) und **Kategorie-Filter**, **Löschen**.
- Migration v2 legt `categories` (mit AT-Startliste) und `receipts` an.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo test --lib` grün; `cargo build` ohne Fehler.
- Stand als **`v0.3.0`** getaggt und gepusht.

## Bewusst NICHT in 2a (kommt später)

- Tageskasse-Zähler & Tagesabschluss (Plan 2b), Dashboard + Export (Plan 2b), Handy-Scanner (Plan 2c).
- Beleg-**Vorschau** des Bilds/PDFs im Fenster (nur Metadaten + Dateityp in 2a; `read_receipt_file` ist für 2b/Vorschau bereits vorbereitet).
- Eigene Kategorien in der UI anlegen (Datenzugriff `addCategory` existiert, UI folgt bei Bedarf).
