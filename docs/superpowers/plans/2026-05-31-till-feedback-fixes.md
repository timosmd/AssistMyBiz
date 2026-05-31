# Tageskasse/Belege — Feedback-Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fünf vom Nutzer per In-App-Bug-Reporter gemeldete Mängel im `/till`-Modul beheben (zwei davon kleine Features: Beleg ansehen, Tagesabschluss-Historie).

**Tech Stack:** React 19 + TS + Tailwind, Tauri 2 (tauri-plugin-opener bereits registriert), Vitest.

---

## Gruppe A — schnelle Fixes

### Fix A1 (Bug 5): Bug-Reporter schließt nach „Senden" automatisch

**Files:** `src/features/bugreport/BugReportModal.tsx`, `…/BugReportModal.test.tsx`

- [ ] **Step 1: Test anpassen.** In `BugReportModal.test.tsx` den Test „shows a confirmation after a successful send" ersetzen durch:
```tsx
  it("closes itself after a successful send", async () => {
    reportSink.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/till"]}>
        <BugReportModal onClose={onClose} />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/beschreibung/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
```
(`vi` ist bereits importiert; falls `waitFor` fehlt, nutze `import { waitFor } from "@testing-library/react"` und `await waitFor(...)`.)

- [ ] **Step 2: Run → FAIL** (`npm test -- BugReportModal`).

- [ ] **Step 3: Implementieren.** In `BugReportModal.tsx`: den `gesendet`-State und den Bestätigungs-Zweig entfernen; bei Erfolg statt `setGesendet(true)` einfach **`onClose()`** aufrufen. Konkret: entferne `const [gesendet, setGesendet] = useState(false);`, ersetze im `try` `setGesendet(true);` durch `onClose();`, und ersetze den `return`-JSX so, dass es **immer** das Formular zeigt (kein `gesendet ? … : …`). Der „Abbrechen"- und „Senden"-Block bleibt.

- [ ] **Step 4: Run → PASS.** Auch der bestehende „sends a report…"-Test muss grün bleiben (er klickt Senden; `onClose` wird jetzt aufgerufen — er prüft nur `reportSink`-Argumente, bleibt also gültig).

- [ ] **Step 5: Commit** `fix(bugreport): close modal immediately after sending`

### Fix A2 (Bug 4): Zurück-zum-Cockpit-Link

**Files:** Create `src/components/BackLink.tsx`; modify `src/routes/till/TillModule.tsx`, `src/routes/modules/{Checklists,Inventory,Shifts}Placeholder.tsx`; test `src/components/BackLink.test.tsx`

- [ ] **Step 1: Failing Test.** `src/components/BackLink.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it("links back to the cockpit home", () => {
    render(<MemoryRouter><BackLink /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implementieren.** `src/components/BackLink.tsx`:
```tsx
import { Link } from "react-router-dom";

export function BackLink() {
  return (
    <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      ← Zurück zum Cockpit
    </Link>
  );
}
```
Dann `<BackLink />` ganz oben in den `<main>` von `TillModule.tsx` (vor der `<h1>`) und in jede der drei Platzhalter-Seiten (`ChecklistsPlaceholder`, `InventoryPlaceholder`, `ShiftsPlaceholder`) vor die `<h1>` einfügen (Import `import { BackLink } from "@/components/BackLink";`).

- [ ] **Step 4: Run → PASS** (`npm test -- BackLink`). Bestehende TillModule-Tests bleiben gültig.

- [ ] **Step 5: Commit** `fix(till): add back-to-cockpit link to module pages`

### Fix A3 (Bug 2a): Kassenzähler — leeres Feld bleibt leer (keine führende 0)

**Files:** `src/features/till/CashCounter.tsx`, `…/CashCounter.test.tsx`

- [ ] **Step 1: Test ergänzen** (im bestehenden `describe`):
```tsx
  it("leaves the input empty (not 0) when cleared", async () => {
    const onTotal = vi.fn();
    render(<CashCounter onTotal={onTotal} />);
    const input = screen.getByLabelText(/anzahl 5,00 €/i) as HTMLInputElement;
    await userEvent.type(input, "2");
    await userEvent.clear(input);
    expect(input.value).toBe("");
    expect(onTotal).toHaveBeenLastCalledWith(0);
  });
```

- [ ] **Step 2: Run → FAIL** (zeigt aktuell „0").

- [ ] **Step 3: Implementieren.** In `CashCounter.tsx` die `setCount`-Funktion ersetzen durch:
```tsx
  function setCount(denom: number, raw: string) {
    const next = { ...counts };
    if (raw === "") delete next[denom];
    else next[denom] = Number(raw);
    setCounts(next);
    onTotal(totalFromCounts(next));
  }
```
(Der `value={counts[d] ?? ""}` bleibt — nach dem Löschen ist der Key weg → leeres Feld.)

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit** `fix(till): cash counter input clears to empty instead of 0`

### Fix A4 (Bug 2b/2c): Tageskasse verständlicher (Erklärtexte)

**Files:** `src/features/till/DailyCloseView.tsx` (nur Text, kein Test)

- [ ] **Step 1: Hinweise einfügen.** In `DailyCloseView.tsx`:
  - Direkt unter der `<h…>`/oben im Wurzel-`<div>` eine kurze Erklärzeile:
    `<p className="text-sm text-muted-foreground">Zähle dein Bargeld (Ist), trage den erwarteten Stand (Soll) und den Tagesumsatz ein — die Kassendifferenz wird berechnet.</p>`
  - Unter dem **Soll**-Input ein `<span className="text-xs text-muted-foreground">Erwarteter Kassenstand</span>`.
  - Unter dem **Tagesumsatz**-Input ein `<span className="text-xs text-muted-foreground">Summe der Tageseinnahmen — manuell eintragen</span>`.

- [ ] **Step 2: Build prüfen** (`npm run build`).

- [ ] **Step 3: Commit** `fix(till): clarify Tageskasse labels (Soll/Umsatz hints)`

---

## Gruppe B — kleine Features

### Fix B1 (Bug 1): Beleg ansehen/öffnen

**Files:** `src-tauri/src/receipts.rs`, `src-tauri/src/lib.rs`; `src/features/receipts/{ReceiptCard,ReceiptList}.tsx`, `…/ReceiptList.test.tsx`

- [ ] **Step 1: Rust-Command.** In `src-tauri/src/receipts.rs` oben `use tauri_plugin_opener::OpenerExt;` ergänzen und einen Command hinzufügen (nutzt den Pfad-Guard aus dem export-Modul):
```rust
#[tauri::command]
pub fn open_receipt_file(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    if !crate::export::is_safe_relative(&relative_path) {
        return Err("Unzulässiger Pfad".to_string());
    }
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts").join(&relative_path);
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}
```
In `src-tauri/src/lib.rs` `receipts::open_receipt_file` zum `invoke_handler` ergänzen (bestehende behalten). `cargo build` muss durchlaufen (`cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build`). Falls die opener-Rust-API anders heißt, minimal anpassen, Verhalten gleich lassen.

- [ ] **Step 2: ReceiptCard „Öffnen"-Button.** In `ReceiptCard.tsx` die Props um `onOpen` erweitern: `{ receipt: Receipt; onDelete: (id: number) => void; onOpen: (receipt: Receipt) => void }`. Vor dem „Löschen"-Button einen Button einfügen, **nur wenn** `receipt.dateiPfad`:
```tsx
        {receipt.dateiPfad && (
          <button type="button" aria-label={`Beleg ${receipt.id} öffnen`} onClick={() => onOpen(receipt)}
            className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-primary">
            Öffnen
          </button>
        )}
```

- [ ] **Step 3: ReceiptList verdrahtet onOpen (TDD).** Test in `ReceiptList.test.tsx` ergänzen: mocke zusätzlich `@tauri-apps/api/core` (`invoke`); ein Beleg mit `dateiPfad` zeigt „Öffnen", Klick ruft `invoke("open_receipt_file", { relativePath })`:
```tsx
import { invoke } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve()) }));
// … im describe:
  it("opens a receipt file via the open button", async () => {
    render(<ReceiptList reloadKey={0} />);
    await screen.findByText("Bäcker");
    await userEvent.click(screen.getByRole("button", { name: /Beleg 1 öffnen/i }));
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("open_receipt_file", { relativePath: "2026/a.jpg" });
  });
```
(Passe die `sample`-Belege in der Testdatei an, falls Beleg 1 noch keinen `dateiPfad` hat — setze `dateiPfad: "2026/a.jpg", dateiTyp: "jpg"` bei Beleg 1.) In `ReceiptList.tsx` eine `openFile`-Funktion ergänzen, die `invoke("open_receipt_file", { relativePath: r.dateiPfad })` aufruft (mit try/catch → `fehler`), und `onOpen={openFile}` an `ReceiptCard` übergeben.

- [ ] **Step 4: Run → PASS** (`npm test -- ReceiptList`), `npm run build`.

- [ ] **Step 5: Commit** `feat(till): open/view a receipt's file in the OS viewer`

### Fix B2 (Bug 3): Tagesabschluss-Historie (sichtbar, editierbar, löschbar)

**Files:** `src/lib/db/dailyClose.ts`, `…/dailyClose.test.ts`; create `src/features/till/DailyCloseHistory.tsx` (+ test); modify `src/features/till/DailyCloseView.tsx`

- [ ] **Step 1: `deleteDailyClose` (TDD).** Test in `dailyClose.test.ts` ergänzen:
```tsx
describe("deleteDailyClose", () => {
  it("deletes by datum", async () => {
    execute.mockResolvedValue(undefined);
    const { deleteDailyClose } = await import("./dailyClose");
    await deleteDailyClose("2026-05-31");
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM daily_close WHERE datum = \$1/i);
    expect(params).toEqual(["2026-05-31"]);
  });
});
```
Implementieren in `dailyClose.ts`:
```ts
export async function deleteDailyClose(datum: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM daily_close WHERE datum = $1", [datum]);
}
```

- [ ] **Step 2: DailyCloseHistory (TDD).** Test `src/features/till/DailyCloseHistory.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const deleteDailyClose = vi.fn();
vi.mock("@/lib/db/dailyClose", () => ({
  listDailyCloses: vi.fn(async () => [
    { datum: "2026-05-31", gezaehltCent: 1000, sollCent: 1230, umsatzCent: 5000, notiz: null },
  ]),
  deleteDailyClose: (...a: unknown[]) => deleteDailyClose(...a),
}));
import { DailyCloseHistory } from "./DailyCloseHistory";

describe("DailyCloseHistory", () => {
  it("lists closes and supports edit + delete", async () => {
    const onEdit = vi.fn();
    render(<DailyCloseHistory reloadKey={0} onEdit={onEdit} />);
    expect(await screen.findByText("2026-05-31")).toBeInTheDocument();
    expect(screen.getByText(/50,00 €/)).toBeInTheDocument(); // Umsatz
    await userEvent.click(screen.getByRole("button", { name: /2026-05-31 bearbeiten/i }));
    expect(onEdit).toHaveBeenCalledWith("2026-05-31");
    await userEvent.click(screen.getByRole("button", { name: /2026-05-31 löschen/i }));
    expect(deleteDailyClose).toHaveBeenCalledWith("2026-05-31");
  });
});
```
Implementieren `src/features/till/DailyCloseHistory.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listDailyCloses, deleteDailyClose, type DailyClose } from "@/lib/db/dailyClose";
import { difference } from "./denominations";
import { formatEuro } from "@/lib/money";

export function DailyCloseHistory({ reloadKey, onEdit }: { reloadKey: number; onEdit: (datum: string) => void }) {
  const [rows, setRows] = useState<DailyClose[]>([]);

  async function reload() {
    const all = await listDailyCloses();
    setRows([...all].sort((a, b) => b.datum.localeCompare(a.datum)));
  }
  useEffect(() => { reload(); }, [reloadKey]);

  async function remove(datum: string) {
    await deleteDailyClose(datum);
    await reload();
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Tagesabschlüsse.</p>;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Bisherige Tagesabschlüsse</h3>
      {rows.map((r) => (
        <div key={r.datum} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium">{r.datum}</span>
            <span className="text-sm text-muted-foreground">
              Ist {formatEuro(r.gezaehltCent ?? 0)} · Soll {formatEuro(r.sollCent ?? 0)} · Umsatz {formatEuro(r.umsatzCent ?? 0)} · Diff {formatEuro(difference(r.gezaehltCent ?? 0, r.sollCent ?? 0))}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label={`${r.datum} bearbeiten`} onClick={() => onEdit(r.datum)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-primary">Bearbeiten</button>
            <button type="button" aria-label={`${r.datum} löschen`} onClick={() => remove(r.datum)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">Löschen</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: In DailyCloseView einhängen.** In `DailyCloseView.tsx`: einen `historyKey`-State (`useState(0)`) ergänzen; im `save()` nach Erfolg `setHistoryKey((k) => k + 1)` aufrufen; unter dem „Tagesabschluss speichern"-Button rendern:
```tsx
      <DailyCloseHistory reloadKey={historyKey} onEdit={(d) => { setDatum(d); setGespeichert(false); }} />
```
(Import ergänzen. `setDatum` lädt über den bestehenden `useEffect([datum])` die Werte des gewählten Tages → „Bearbeiten".)

- [ ] **Step 4: Run → PASS** (`npm test -- DailyCloseHistory dailyClose DailyCloseView`), `npm run build`.

- [ ] **Step 5: Commit** `feat(till): daily-close history with edit + delete`

---

## Abschluss

- [ ] **Volltest:** `npm test` (alle grün), `npm run build` (keine TS-Fehler), `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib && cargo build`.
- [ ] **Tag & Push:** `git tag -a v0.6.1 -m "v0.6.1 — Feedback-Fixes (Belege ansehen, Tagesabschluss-Historie, Navigation, UX)"` und `git push --follow-tags`.

## Definition of Done

- Beleg mit Datei hat „Öffnen" → öffnet im OS-Viewer; Bug-Reporter schließt nach Senden; Kassenzähler-Feld bleibt beim Löschen leer; Tageskasse hat Erklärtexte; Zurück-zum-Cockpit-Link auf allen Modulseiten; Tagesabschluss-Historie sichtbar + bearbeiten/löschen.
- Alle Tests grün; getaggt `v0.6.1`.
