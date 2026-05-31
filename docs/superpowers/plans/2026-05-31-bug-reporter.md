# In-App Bug-Reporter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Dev-only Bug-Reporter im Laden-Cockpit: ein Hover-FAB unten rechts öffnet ein Modal (Beschreibung + Priorität), hängt einen Log-Ringpuffer an und schreibt einen Markdown-Report nach `<repo>/bug-reports/`, den Claude direkt lesen kann.

**Architecture:** Reine, getestete Logik (Ringpuffer, Markdown-Formatierung) getrennt von UI (FAB, Modal) und Persistenz. Das Schreiben übernimmt ein Rust-Command (`write_bug_report`), der Dateinamen validiert und in den Repo-Ordner schreibt (Pfad über `env!("CARGO_MANIFEST_DIR")`). Eine `reportSink`-Schnittstelle kapselt das „Wohin" — v1 schreibt lokal (FileSink), eine spätere RemoteSink ließe sich ergänzen. Der FAB wird nur im Dev-Build (`import.meta.env.DEV`) gemountet.

**Tech Stack:** React 19 + TypeScript, Tailwind, react-router (für die Route im Kontext), Tauri 2 (Rust-Command, `@tauri-apps/api/core` invoke, `@tauri-apps/api/app` getVersion), Vitest + Testing Library.

---

## File Structure

```
src/features/bugreport/
  logBuffer.ts          # Ringpuffer + logEvent + Console-Capture (rein, testbar)
  logBuffer.test.ts
  formatReport.ts       # BugReport -> Markdown + Dateiname (reine Funktionen)
  formatReport.test.ts
  sink.ts               # reportSink(report): formatiert + ruft Rust-Command
  sink.test.ts
  BugReportModal.tsx    # Formular (Beschreibung Pflicht + Priorität)
  BugReportModal.test.tsx
  BugReportFab.tsx      # Hover-FAB + öffnet Modal
  BugReportFab.test.tsx
src-tauri/src/
  bugreport.rs          # write_bug_report-Command + Helfer (+ Rust-Tests)
src/main.tsx            # installConsoleCapture() im DEV
src/App.tsx             # <BugReportFab/> global im DEV mounten
.gitignore              # bug-reports/
```

---

## Task 1: Log-Ringpuffer — TDD

**Files:**
- Create: `src/features/bugreport/logBuffer.ts`
- Test: `src/features/bugreport/logBuffer.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/bugreport/logBuffer.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { pushLog, getLog, clearLog, logEvent, installConsoleCapture, MAX_LOG } from "./logBuffer";

beforeEach(() => clearLog());

describe("ring buffer", () => {
  it("keeps only the last MAX_LOG lines (FIFO)", () => {
    for (let i = 0; i < MAX_LOG + 10; i++) pushLog(`line ${i}`);
    const log = getLog();
    expect(log).toHaveLength(MAX_LOG);
    expect(log[0]).toBe("line 10");
    expect(log[log.length - 1]).toBe(`line ${MAX_LOG + 9}`);
  });
  it("getLog returns a copy, not the internal array", () => {
    pushLog("a");
    const a = getLog();
    a.push("mutated");
    expect(getLog()).toEqual(["a"]);
  });
  it("logEvent appends a line containing the message", () => {
    logEvent("Beleg gespeichert");
    expect(getLog()[0]).toMatch(/Beleg gespeichert/);
  });
});

describe("installConsoleCapture", () => {
  it("captures console.error into the buffer and is idempotent", () => {
    // Spy BEFORE install so the capture wrapper forwards to the (silent) spy.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    installConsoleCapture();
    installConsoleCapture(); // idempotent
    console.error("boom", 42);
    spy.mockRestore();
    expect(getLog().some((l) => l.includes("boom") && l.includes("42"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- logBuffer`
Expected: FAIL („Cannot find module './logBuffer'").

- [ ] **Step 3: Implement**

Create `src/features/bugreport/logBuffer.ts`:
```ts
export const MAX_LOG = 100;

let buffer: string[] = [];

export function pushLog(line: string): void {
  buffer.push(line);
  if (buffer.length > MAX_LOG) buffer.splice(0, buffer.length - MAX_LOG);
}

export function getLog(): string[] {
  return [...buffer];
}

export function clearLog(): void {
  buffer = [];
}

export function logEvent(msg: string): void {
  pushLog(`${new Date().toISOString()} ${msg}`);
}

let patched = false;

/** Leitet console.error/warn zusätzlich in den Ringpuffer. Idempotent. */
export function installConsoleCapture(): void {
  if (patched) return;
  patched = true;
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    pushLog(`ERROR ${args.map(String).join(" ")}`);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    pushLog(`WARN ${args.map(String).join(" ")}`);
    origWarn(...args);
  };
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- logBuffer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bugreport/logBuffer.ts src/features/bugreport/logBuffer.test.ts
git commit -m "feat(bugreport): log ring buffer with console capture"
```

---

## Task 2: Report-Formatierung — TDD

**Files:**
- Create: `src/features/bugreport/formatReport.ts`
- Test: `src/features/bugreport/formatReport.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/bugreport/formatReport.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatReport, reportFilename, type BugReport } from "./formatReport";

const report: BugReport = {
  zeit: "2026-05-31T22:10:00.000Z",
  prio: "Hoch",
  route: "/till",
  version: "0.3.0",
  os: "Mozilla/5.0 (Windows NT 10.0)",
  beschreibung: "Speichern hängt",
  log: ["ERROR boom", "WARN langsam"],
};

describe("formatReport", () => {
  it("renders frontmatter and both sections", () => {
    const md = formatReport(report);
    expect(md).toMatch(/^---\n/);
    expect(md).toMatch(/prio: Hoch/);
    expect(md).toMatch(/route: \/till/);
    expect(md).toMatch(/## Beschreibung\nSpeichern hängt/);
    expect(md).toMatch(/## Log\nERROR boom\nWARN langsam/);
  });
});

describe("reportFilename", () => {
  it("builds a filesystem-safe name from time and priority", () => {
    expect(reportFilename("2026-05-31T22:10:00.000Z", "Hoch")).toBe(
      "2026-05-31T22-10-00-000Z_Hoch.md",
    );
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- formatReport`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/bugreport/formatReport.ts`:
```ts
export type Priority = "Niedrig" | "Mittel" | "Hoch" | "Kritisch";

export interface BugReport {
  zeit: string;
  prio: Priority;
  route: string;
  version: string;
  os: string;
  beschreibung: string;
  log: string[];
}

export function formatReport(r: BugReport): string {
  return (
    `---\n` +
    `zeit: ${r.zeit}\n` +
    `prio: ${r.prio}\n` +
    `route: ${r.route}\n` +
    `version: ${r.version}\n` +
    `os: ${r.os}\n` +
    `---\n\n` +
    `## Beschreibung\n${r.beschreibung}\n\n` +
    `## Log\n${r.log.join("\n")}\n`
  );
}

export function reportFilename(zeitIso: string, prio: Priority): string {
  return `${zeitIso.replace(/[:.]/g, "-")}_${prio}.md`;
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- formatReport`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bugreport/formatReport.ts src/features/bugreport/formatReport.test.ts
git commit -m "feat(bugreport): pure report markdown + filename"
```

---

## Task 3: Rust write_bug_report-Command — TDD

**Files:**
- Create: `src-tauri/src/bugreport.rs`
- Modify: `src-tauri/src/lib.rs` (Modul + Command registrieren)

- [ ] **Step 1: Reine Helfer + Rust-Tests schreiben**

Create `src-tauri/src/bugreport.rs`:
```rust
use std::path::PathBuf;

/// Sicherer Dateiname: endet auf .md, keine Pfadtrenner, kein "..".
pub fn is_safe_filename(name: &str) -> bool {
    name.ends_with(".md")
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
}

/// Repo-Ordner (Elternverzeichnis von src-tauri) zur Compile-Zeit.
fn reports_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
        .join("bug-reports")
}

#[tauri::command]
pub fn write_bug_report(filename: String, content: String) -> Result<String, String> {
    if !is_safe_filename(&filename) {
        return Err("Ungültiger Dateiname".to_string());
    }
    let dir = reports_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&filename);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn safe_filename_accepts_plain_md_and_rejects_traversal() {
        assert!(is_safe_filename("2026-05-31T22-10-00-000Z_Hoch.md"));
        assert!(!is_safe_filename("../escape.md"));
        assert!(!is_safe_filename("sub/dir.md"));
        assert!(!is_safe_filename("no-extension"));
        assert!(!is_safe_filename("a\\b.md"));
    }
}
```
Note: `tauri::Manager` is imported to keep the command signature uniform with other commands; `_app` is unused on purpose (prefixed `_`).

- [ ] **Step 2: Modul + Command in `lib.rs` registrieren**

In `src-tauri/src/lib.rs` oben ergänzen:
```rust
mod bugreport;
```
und im `invoke_handler` ergänzen (bestehende Einträge wie `receipts::*`, `greet` behalten):
```rust
            bugreport::write_bug_report,
```

- [ ] **Step 3: Rust-Test + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -12`
Expected: `safe_filename_accepts_plain_md_and_rejects_traversal ... ok`, Build ohne Fehler.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/bugreport.rs src-tauri/src/lib.rs
git commit -m "feat(bugreport): rust write_bug_report command with safe filename"
```

---

## Task 4: reportSink — TDD

**Files:**
- Create: `src/features/bugreport/sink.ts`
- Test: `src/features/bugreport/sink.test.ts`

- [ ] **Step 1: Failing Test (invoke gemockt)**

Create `src/features/bugreport/sink.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { reportSink } from "./sink";
import type { BugReport } from "./formatReport";

const report: BugReport = {
  zeit: "2026-05-31T22:10:00.000Z",
  prio: "Hoch",
  route: "/till",
  version: "0.3.0",
  os: "agent",
  beschreibung: "Speichern hängt",
  log: ["ERROR boom"],
};

beforeEach(() => invoke.mockReset());

describe("reportSink", () => {
  it("invokes write_bug_report with the filename and formatted content", async () => {
    invoke.mockResolvedValue("C:/repo/bug-reports/x.md");
    await reportSink(report);
    expect(invoke).toHaveBeenCalledTimes(1);
    const [cmd, args] = invoke.mock.calls[0] as [string, { filename: string; content: string }];
    expect(cmd).toBe("write_bug_report");
    expect(args.filename).toBe("2026-05-31T22-10-00-000Z_Hoch.md");
    expect(args.content).toMatch(/## Beschreibung\nSpeichern hängt/);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- bugreport/sink`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/bugreport/sink.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
import { formatReport, reportFilename, type BugReport } from "./formatReport";

/** v1: schreibt den Report lokal über den Rust-Command (FileSink). */
export async function reportSink(report: BugReport): Promise<void> {
  const content = formatReport(report);
  const filename = reportFilename(report.zeit, report.prio);
  await invoke("write_bug_report", { filename, content });
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- bugreport/sink`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bugreport/sink.ts src/features/bugreport/sink.test.ts
git commit -m "feat(bugreport): file sink via write_bug_report"
```

---

## Task 5: BugReportModal — TDD

**Files:**
- Create: `src/features/bugreport/BugReportModal.tsx`
- Test: `src/features/bugreport/BugReportModal.test.tsx`

- [ ] **Step 1: Failing Test (sink + version gemockt; Router-Kontext)**

Create `src/features/bugreport/BugReportModal.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const reportSink = vi.fn();
vi.mock("./sink", () => ({ reportSink: (...a: unknown[]) => reportSink(...a) }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "0.3.0") }));

import { BugReportModal } from "./BugReportModal";

beforeEach(() => reportSink.mockReset());

function renderModal() {
  return render(
    <MemoryRouter initialEntries={["/till"]}>
      <BugReportModal onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("BugReportModal", () => {
  it("blocks sending with an empty description", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    expect(reportSink).not.toHaveBeenCalled();
    expect(screen.getByText(/bitte eine beschreibung/i)).toBeInTheDocument();
  });

  it("sends a report with description, priority and route", async () => {
    reportSink.mockResolvedValue(undefined);
    renderModal();
    await userEvent.type(screen.getByLabelText(/beschreibung/i), "Speichern hängt");
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    expect(reportSink).toHaveBeenCalledTimes(1);
    const arg = reportSink.mock.calls[0][0];
    expect(arg.beschreibung).toBe("Speichern hängt");
    expect(arg.route).toBe("/till");
    expect(arg.prio).toBe("Mittel");
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- BugReportModal`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/bugreport/BugReportModal.tsx`:
```tsx
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { reportSink } from "./sink";
import { getLog } from "./logBuffer";
import type { Priority } from "./formatReport";

const PRIOS: Priority[] = ["Niedrig", "Mittel", "Hoch", "Kritisch"];

export function BugReportModal({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const [beschreibung, setBeschreibung] = useState("");
  const [prio, setPrio] = useState<Priority>("Mittel");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);

  async function send() {
    if (beschreibung.trim() === "") {
      setFehler("Bitte eine Beschreibung eingeben.");
      return;
    }
    setFehler(null);
    const version = await getVersion().catch(() => "?");
    try {
      await reportSink({
        zeit: new Date().toISOString(),
        prio,
        route: location.pathname,
        version,
        os: navigator.userAgent,
        beschreibung: beschreibung.trim(),
        log: getLog(),
      });
      setGesendet(true);
    } catch {
      setFehler("Konnte den Report nicht speichern.");
    }
  }

  return (
    <div role="dialog" aria-label="Bug melden"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Bug melden</h2>
        {gesendet ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Danke! Der Report wurde gespeichert.</p>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Schließen
            </button>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Beschreibung</span>
              <textarea aria-label="Beschreibung" value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)} rows={4}
                className="rounded-xl border border-border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Priorität</span>
              <select aria-label="Priorität" value={prio}
                onChange={(e) => setPrio(e.target.value as Priority)}
                className="rounded-xl border border-border px-3 py-2">
                {PRIOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-sm">Abbrechen</button>
              <button type="button" onClick={send}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- BugReportModal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bugreport/BugReportModal.tsx src/features/bugreport/BugReportModal.test.tsx
git commit -m "feat(bugreport): modal with description + priority + context"
```

---

## Task 6: BugReportFab — TDD

**Files:**
- Create: `src/features/bugreport/BugReportFab.tsx`
- Test: `src/features/bugreport/BugReportFab.test.tsx`

- [ ] **Step 1: Failing Test (öffnet Modal)**

Create `src/features/bugreport/BugReportFab.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("./sink", () => ({ reportSink: vi.fn() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "0.3.0") }));

import { BugReportFab } from "./BugReportFab";

describe("BugReportFab", () => {
  it("opens the modal when the FAB is clicked", async () => {
    render(
      <MemoryRouter>
        <BugReportFab />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /bug melden/i }));
    expect(screen.getByRole("dialog", { name: /bug melden/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -- BugReportFab`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/bugreport/BugReportFab.tsx`:
```tsx
import { useState } from "react";
import { BugReportModal } from "./BugReportModal";

export function BugReportFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="group fixed bottom-0 right-0 z-40 h-24 w-24">
        <button type="button" aria-label="Bug melden" onClick={() => setOpen(true)}
          className={
            "absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full " +
            "bg-primary text-lg text-primary-foreground shadow-lg opacity-0 transition-opacity " +
            "duration-200 group-hover:opacity-100 focus-visible:opacity-100"
          }>
          🐞
        </button>
      </div>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -- BugReportFab`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bugreport/BugReportFab.tsx src/features/bugreport/BugReportFab.test.tsx
git commit -m "feat(bugreport): hover-reveal FAB that opens the modal"
```

---

## Task 7: Einhängen (DEV) + .gitignore

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`, `.gitignore`

- [ ] **Step 1: FAB global im DEV mounten**

In `src/App.tsx` den Import ergänzen:
```tsx
import { BugReportFab } from "@/features/bugreport/BugReportFab";
```
und das App-JSX so umbauen, dass der FAB neben den Routen gerendert wird (nur im Dev-Build). Aus:
```tsx
export default function App() {
  return (
    <Routes>
      {/* ...routes... */}
    </Routes>
  );
}
```
wird:
```tsx
export default function App() {
  return (
    <>
      <Routes>
        {/* ...unveränderte routes... */}
      </Routes>
      {import.meta.env.DEV && <BugReportFab />}
    </>
  );
}
```
(Die bestehenden `<Route>`-Einträge unverändert lassen.)

- [ ] **Step 2: Console-Capture im DEV starten**

In `src/main.tsx` vor dem `ReactDOM.createRoot(...)`-Aufruf ergänzen:
```tsx
import { installConsoleCapture } from "@/features/bugreport/logBuffer";

if (import.meta.env.DEV) installConsoleCapture();
```

- [ ] **Step 3: Reports aus Git heraushalten**

In `.gitignore` ans Ende ergänzen:
```
# Local bug reports (dev tool output)
bug-reports/
```

- [ ] **Step 4: Tests + Build**

Run: `npm test`
Expected: alle grün (inkl. logBuffer, formatReport, sink, BugReportModal, BugReportFab + bestehende).
Run: `npm run build`
Expected: keine TS-Fehler.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(bugreport): mount FAB + console capture in dev build"
```

---

## Task 8: Gesamtabnahme + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build**

Run: `npm test` → alle grün.
Run: `npm run build` → keine TS-Fehler.
Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -8 && cargo build 2>&1 | tail -3`
Expected: bugreport-Rust-Test grün, Build ohne Fehler.

- [ ] **Step 2: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.3.1 -m "v0.3.1 — In-App Bug-Reporter (dev tool)"
git push --follow-tags
```

---

## Definition of Done

- Im **Dev-Build** erscheint unten rechts beim Hovern ein 🐞-FAB; Klick öffnet ein Modal (Beschreibung Pflicht + Priorität).
- „Senden" schreibt `<repo>/bug-reports/<zeit>_<prio>.md` mit Frontmatter, Beschreibung und Log-Ringpuffer; leere Beschreibung wird blockiert; Fehler werden sichtbar.
- `console.error/warn` und `logEvent(...)` landen im Ringpuffer (max. 100) und werden angehängt.
- In der ausgelieferten (Nicht-Dev-)Version ist der FAB **nicht** vorhanden.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo test --lib` grün; `cargo build` sauber.
- `bug-reports/` ist gitignored. Stand getaggt **`v0.3.1`** und gepusht.

## Bewusst NICHT in v1

- Remote-/Kunden-Versand (RemoteSink), Screenshots, In-App-Bugliste. Die FileSink + Markdown genügt; Claude liest die Dateien direkt aus `bug-reports/`.
