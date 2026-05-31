# Lager — Bestellung-Reiter Implementation Plan

> **For agentic workers:** built inline (small additive feature). Steps use checkbox syntax.

**Goal:** Fill the existing "Bestellung" tab of the Lager module with an automatic reorder list — all articles at/under their Mindestbestand, grouped by Lieferant, with a one-click export to `nachbestellung.txt`.

**Architecture:** A pure module `reorderList.ts` turns the article list into supplier-grouped reorder items and renders the `nachbestellung.txt` text. `BestellView.tsx` loads articles, shows the grouped list (or an "all stocked" empty state), and exports via a directory dialog + a new Rust `export_reorder` command (mirrors `export_bookkeeping`). No new DB schema — reuses `articles` (Lieferant/Mindestbestand already captured).

**Tech Stack:** React 19 + TS, tauri-plugin-dialog, Rust (`std::fs::write`), Vitest.

---

### Task 1: Pure reorder logic (`reorderList.ts`)

**Files:**
- Create: `src/features/inventory/reorderList.ts`
- Test: `src/features/inventory/reorderList.test.ts`

- [ ] **Types & functions**

```ts
import type { Article } from "@/lib/db/articles";
import { isLowStock } from "./articleFilter";

export interface ReorderItem { article: Article; vorschlag: number }
export interface SupplierGroup { lieferant: string; items: ReorderItem[] }

const OHNE = "Ohne Lieferant";

// Vorschlag = Lücke bis zum Mindestbestand (mind. 0). Transparent & editierbar im Kopf des Kunden.
export function vorschlagMenge(a: Article): number {
  return Math.max(a.mindestbestand - a.bestand, 0);
}

export function buildReorderGroups(articles: Article[]): SupplierGroup[] {
  const low = articles.filter(isLowStock);
  const byLief = new Map<string, ReorderItem[]>();
  for (const a of low) {
    const key = a.lieferant?.trim() ? a.lieferant.trim() : OHNE;
    if (!byLief.has(key)) byLief.set(key, []);
    byLief.get(key)!.push({ article: a, vorschlag: vorschlagMenge(a) });
  }
  return [...byLief.entries()]
    .map(([lieferant, items]) => ({
      lieferant,
      items: items.sort((x, y) => x.article.name.localeCompare(y.article.name, "de")),
    }))
    .sort((g1, g2) => g1.lieferant.localeCompare(g2.lieferant, "de"));
}

export function buildReorderText(groups: SupplierGroup[], datum: string): string {
  const lines: string[] = [`Nachbestellung — ${datum}`, ""];
  if (groups.length === 0) {
    lines.push("Keine Artikel nachzubestellen.");
    return lines.join("\n");
  }
  for (const g of groups) {
    lines.push(`== ${g.lieferant} ==`);
    for (const { article: a, vorschlag } of g.items) {
      const einheit = a.einheit ? ` ${a.einheit}` : "";
      lines.push(`- ${a.name}: ${vorschlag}${einheit} (Bestand ${a.bestand} / Mindest ${a.mindestbestand})`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
```

- [ ] **Tests:** empty list → `[]`; grouping by Lieferant with `OHNE` fallback; group + item sorting (de); `vorschlagMenge` gap & clamp at 0; `buildReorderText` header/sections/format and empty-case text.

---

### Task 2: Rust `export_reorder` command

**Files:**
- Modify: `src-tauri/src/export.rs` (add command)
- Modify: `src-tauri/src/lib.rs` (register in `invoke_handler`)

- [ ] Add to `export.rs` — fixed filename, no path injection:

```rust
#[tauri::command]
pub fn export_reorder(target_dir: String, content: String) -> Result<(), String> {
    let target = std::path::PathBuf::from(&target_dir);
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    std::fs::write(target.join("nachbestellung.txt"), content).map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] Register `crate::export::export_reorder` in the `tauri::generate_handler!` list in `lib.rs`.

---

### Task 3: `BestellView.tsx`

**Files:**
- Create: `src/features/inventory/BestellView.tsx`
- Test: `src/features/inventory/BestellView.test.tsx`

- [ ] Loads `listArticles()`, `buildReorderGroups`, renders grouped cards (Lieferant heading + items with Vorschlag and Bestand/Mindest). Empty → "Alles ausreichend bestückt 🎉". Export button → `open({directory:true})` → `invoke("export_reorder", { targetDir, content: buildReorderText(groups, heute) })`, status/fehler messages. Mirrors `ExportPanel.tsx`.
- [ ] **Tests** (mock `@tauri-apps/plugin-sql`, `@tauri-apps/api/core`, `@tauri-apps/plugin-dialog`): renders a low-stock group; empty state; export invokes `export_reorder` with a content string containing the article name.

---

### Task 4: Wire into the tab

**Files:**
- Modify: `src/routes/inventory/InventoryModule.tsx`

- [ ] Replace the `bestellung` placeholder `<p>` with `<BestellView />`.

---

### Verify
- `npm test` (all green), `npm run build`, `cd src-tauri && cargo build`.
- Tag `v0.10.0`, push, FF-merge to `main`.
