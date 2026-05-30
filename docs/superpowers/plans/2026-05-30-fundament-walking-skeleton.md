# Fundament (Walking Skeleton) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine startende, schöne, leere Windows-App: Tauri + React + Tailwind mit Cockpit-Startseite (4 Kacheln), gemeinsamem Design-System und an SQLite angebundener Datenpersistenz (nachgewiesen durch einen Rauch-Test).

**Architecture:** Tauri-2-Desktop-Hülle (Rust-Kern) mit React/TypeScript-Frontend (Vite). Styling über Tailwind + shadcn/ui. Lokale Persistenz über `tauri-plugin-sql` (SQLite) mit Rust-seitigen Migrationen. Das Frontend spricht die DB über einen schmalen Wrapper (`src/lib/db.ts`) an, dessen Logik per Vitest getestet wird (Tauri-Aufrufe gemockt).

**Tech Stack:** Tauri 2, React 18, TypeScript, Vite, Tailwind CSS 3, shadcn/ui, React Router, `@tauri-apps/plugin-sql` (SQLite), Vitest + Testing Library.

---

## File Structure (wird in diesem Plan angelegt)

```
AssistMyBiz/
├─ index.html                         # Vite-Einstieg
├─ package.json                       # JS-Abhängigkeiten & Skripte
├─ vite.config.ts                     # Vite-Konfiguration
├─ vitest.config.ts                   # Test-Konfiguration
├─ tsconfig.json                      # TypeScript + Pfad-Alias @/*
├─ tailwind.config.js                 # Design-Tokens (Farben, Radius, Font)
├─ postcss.config.js
├─ components.json                    # shadcn/ui-Konfiguration
├─ src/
│  ├─ main.tsx                        # React-Bootstrap + Router
│  ├─ App.tsx                         # Routen-Definition
│  ├─ test/setup.ts                   # Vitest-Setup (jest-dom)
│  ├─ styles/index.css                # Tailwind-Direktiven + Basis
│  ├─ lib/
│  │  ├─ utils.ts                     # cn()-Helper (shadcn)
│  │  └─ db.ts                        # SQLite-Wrapper (getDb/getSetting/setSetting)
│  ├─ config/
│  │  └─ modules.tsx                  # MODULES: die 4 Kachel-Definitionen
│  ├─ components/
│  │  └─ ModuleTile.tsx               # eine Cockpit-Kachel
│  └─ routes/
│     ├─ Cockpit.tsx                  # Startseite mit 4 Kacheln
│     └─ modules/
│        ├─ ChecklistsPlaceholder.tsx
│        ├─ TillPlaceholder.tsx
│        ├─ InventoryPlaceholder.tsx
│        └─ ShiftsPlaceholder.tsx
└─ src-tauri/
   ├─ Cargo.toml                      # Rust-Abhängigkeiten (+ tauri-plugin-sql)
   ├─ tauri.conf.json                 # Tauri-Konfiguration
   └─ src/
      └─ lib.rs                       # Plugin-Registrierung + SQL-Migrationen
```

---

## Task 0: Voraussetzungen prüfen (Windows)

**Files:** keine (nur Umgebung)

- [ ] **Step 1: Node.js prüfen**

Run: `node --version`
Expected: `v20.x` oder höher. Falls fehlt → von https://nodejs.org installieren (LTS).

- [ ] **Step 2: Rust prüfen**

Run: `rustc --version`
Expected: `rustc 1.7x.x` o. ä. Falls fehlt → https://rustup.rs installieren, Terminal neu öffnen.

- [ ] **Step 3: C++-Build-Tools & WebView2 prüfen**

Run: `cargo --version`
Expected: gibt eine Version aus. Falls `link.exe`-Fehler später auftreten → „Microsoft C++ Build Tools" (Desktop development with C++) installieren. WebView2 ist auf Windows 11 vorinstalliert.

---

## Task 1: Tauri + React + TypeScript scaffolden

**Files:**
- Create (durch Scaffold): `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src-tauri/*`

- [ ] **Step 1: Projekt im aktuellen Ordner scaffolden**

Run (im Projekt-Root, der bereits `docs/` und `.git` enthält):
```bash
npm create tauri-app@latest assist-tmp -- --template react-ts --manager npm
```
Dies erzeugt einen Unterordner `assist-tmp`. Inhalt anschließend ins Root verschieben:
```bash
# Windows PowerShell:
Move-Item -Path assist-tmp/* -Destination . -Force
Move-Item -Path assist-tmp/.gitignore -Destination ./.gitignore-tauri -Force
Remove-Item -Recurse -Force assist-tmp
```
Den von Tauri mitgelieferten `.gitignore-tauri` mit der vorhandenen `.gitignore` abgleichen (vorhandene behalten; fehlende Einträge ergänzen), dann `.gitignore-tauri` löschen.

- [ ] **Step 2: Abhängigkeiten installieren**

Run: `npm install`
Expected: legt `node_modules/` an, keine Fehler.

- [ ] **Step 3: App testweise starten**

Run: `npm run tauri dev`
Expected: Ein natives Fenster öffnet sich mit der Tauri-React-Startseite. Fenster wieder schließen (Strg+C im Terminal).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri 2 + React + TypeScript app"
```

---

## Task 2: Tailwind CSS einrichten

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`, `src/styles/index.css`
- Modify: `src/main.tsx` (CSS importieren), `index.html` (Font)

- [ ] **Step 1: Tailwind installieren**

Run:
```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```
Expected: erzeugt `tailwind.config.js` und `postcss.config.js`.

- [ ] **Step 2: `tailwind.config.js` mit Design-Tokens füllen**

Ersetze den Inhalt von `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Freundliche, warme Palette (CSS-Variablen aus index.css)
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: `src/styles/index.css` anlegen (Tailwind + Design-Variablen)**

Create `src/styles/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 40 33% 98%;        /* warmes Off-White */
  --foreground: 220 20% 20%;
  --card: 0 0% 100%;
  --card-foreground: 220 20% 20%;
  --primary: 168 60% 40%;         /* freundliches Teal */
  --primary-foreground: 0 0% 100%;
  --muted: 40 20% 94%;
  --muted-foreground: 220 12% 45%;
  --border: 40 15% 88%;
}

body {
  @apply bg-background text-foreground font-sans antialiased;
}
```

- [ ] **Step 4: CSS importieren & Font einbinden**

In `src/main.tsx` den vorhandenen CSS-Import (z. B. `./styles.css`) ersetzen durch:
```tsx
import "./styles/index.css";
```
In `index.html` im `<head>` ergänzen:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 5: Sichtprüfung**

Run: `npm run tauri dev`
Expected: App startet weiterhin; Hintergrund ist warmes Off-White, Schrift ist Inter. Fenster schließen.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind with friendly design tokens"
```

---

## Task 3: Pfad-Alias + shadcn/ui-Helfer

**Files:**
- Modify: `tsconfig.json`, `vite.config.ts`
- Create: `src/lib/utils.ts`, `components.json`

- [ ] **Step 1: Pfad-Alias `@/*` in `tsconfig.json`**

In `tsconfig.json` unter `compilerOptions` ergänzen:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 2: Alias auch in Vite bekannt machen**

Run: `npm install -D @types/node`
In `vite.config.ts` oben ergänzen und `resolve.alias` setzen:
```ts
import path from "path";
// innerhalb von defineConfig({ ... }):
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
```

- [ ] **Step 3: `cn()`-Helper anlegen**

Run: `npm install clsx tailwind-merge`
Create `src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: `components.json` für shadcn/ui anlegen**

Create `components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure @/ alias and shadcn cn() helper"
```

---

## Task 4: Test-Infrastruktur (Vitest + Testing Library)

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `package.json` (test-Skript)

- [ ] **Step 1: Test-Abhängigkeiten installieren**

Run:
```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: `vitest.config.ts` anlegen**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 3: `src/test/setup.ts` anlegen**

Create `src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: test-Skript in `package.json`**

In `package.json` unter `"scripts"` ergänzen:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Smoke-Test, dass Vitest läuft**

Create `src/test/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```
Run: `npm test`
Expected: PASS (1 Test grün).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: set up Vitest + Testing Library"
```

---

## Task 5: Modul-Definitionen (Daten) — TDD

**Files:**
- Create: `src/config/modules.tsx`
- Test: `src/config/modules.test.ts`

- [ ] **Step 1: Failing Test schreiben**

Create `src/config/modules.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MODULES } from "./modules";

describe("MODULES", () => {
  it("defines exactly the four v1 modules in order", () => {
    expect(MODULES.map((m) => m.id)).toEqual([
      "checklists",
      "till",
      "inventory",
      "shifts",
    ]);
  });

  it("each module has title, description and a route path", () => {
    for (const m of MODULES) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.path.startsWith("/")).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Test ausführen → soll fehlschlagen**

Run: `npm test`
Expected: FAIL („Cannot find module './modules'").

- [ ] **Step 3: Minimale Implementierung**

Create `src/config/modules.tsx`:
```tsx
import { ClipboardCheck, Wallet, Package, CalendarDays, type LucideIcon } from "lucide-react";

export interface ModuleDef {
  id: "checklists" | "till" | "inventory" | "shifts";
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const MODULES: ModuleDef[] = [
  { id: "checklists", title: "Checklisten", description: "Öffnen, Schließen & wiederkehrende Aufgaben abhaken", path: "/checklists", icon: ClipboardCheck },
  { id: "till", title: "Tageskasse & Belege", description: "Kasse zählen, Belege sammeln, Steuer vorbereiten", path: "/till", icon: Wallet },
  { id: "inventory", title: "Lager", description: "Bestände im Blick, automatische Nachbestell-Liste", path: "/inventory", icon: Package },
  { id: "shifts", title: "Schichten", description: "Wochenplan, Auslastung & Urlaube", path: "/shifts", icon: CalendarDays },
];
```
Run: `npm install lucide-react`

- [ ] **Step 4: Test ausführen → soll bestehen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: define the four v1 module descriptors"
```

---

## Task 6: ModuleTile-Komponente — TDD

**Files:**
- Create: `src/components/ModuleTile.tsx`
- Test: `src/components/ModuleTile.test.tsx`

- [ ] **Step 1: Failing Test schreiben**

Create `src/components/ModuleTile.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Wallet } from "lucide-react";
import { ModuleTile } from "./ModuleTile";

function renderTile() {
  return render(
    <MemoryRouter>
      <ModuleTile title="Tageskasse" description="Kasse & Belege" path="/till" icon={Wallet} />
    </MemoryRouter>
  );
}

describe("ModuleTile", () => {
  it("shows the title and description", () => {
    renderTile();
    expect(screen.getByText("Tageskasse")).toBeInTheDocument();
    expect(screen.getByText("Kasse & Belege")).toBeInTheDocument();
  });

  it("links to its module path", () => {
    renderTile();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/till");
  });
});
```

- [ ] **Step 2: Test ausführen → soll fehlschlagen**

Run: `npm test`
Expected: FAIL („Cannot find module './ModuleTile'"). Vorher React Router installieren:
```bash
npm install react-router-dom
```

- [ ] **Step 3: Minimale Implementierung**

Create `src/components/ModuleTile.tsx`:
```tsx
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleTileProps {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export function ModuleTile({ title, description, path, icon: Icon }: ModuleTileProps) {
  return (
    <Link
      to={path}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6",
        "shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary"
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold text-card-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Test ausführen → soll bestehen**

Run: `npm test`
Expected: PASS (beide ModuleTile-Tests grün).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ModuleTile component"
```

---

## Task 7: Cockpit-Startseite + Routing — TDD

**Files:**
- Create: `src/routes/Cockpit.tsx`, `src/routes/modules/*Placeholder.tsx`, `src/App.tsx`
- Test: `src/routes/Cockpit.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Failing Test schreiben**

Create `src/routes/Cockpit.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Cockpit } from "./Cockpit";

describe("Cockpit", () => {
  it("renders one tile per module (four links)", () => {
    render(
      <MemoryRouter>
        <Cockpit />
      </MemoryRouter>
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByText("Tageskasse & Belege")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test ausführen → soll fehlschlagen**

Run: `npm test`
Expected: FAIL („Cannot find module './Cockpit'").

- [ ] **Step 3: Cockpit implementieren**

Create `src/routes/Cockpit.tsx`:
```tsx
import { MODULES } from "@/config/modules";
import { ModuleTile } from "@/components/ModuleTile";

export function Cockpit() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laden-Cockpit</h1>
        <p className="text-muted-foreground">Dein Tag auf einen Blick.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <ModuleTile key={m.id} title={m.title} description={m.description} path={m.path} icon={m.icon} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Platzhalter-Seiten anlegen (alle vier vollständig)**

Create `src/routes/modules/ChecklistsPlaceholder.tsx`:
```tsx
export function ChecklistsPlaceholder() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Checklisten</h1>
      <p className="text-muted-foreground">Kommt als Nächstes.</p>
    </main>
  );
}
```

Create `src/routes/modules/TillPlaceholder.tsx`:
```tsx
export function TillPlaceholder() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Tageskasse & Belege</h1>
      <p className="text-muted-foreground">Kommt als Nächstes.</p>
    </main>
  );
}
```

Create `src/routes/modules/InventoryPlaceholder.tsx`:
```tsx
export function InventoryPlaceholder() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Lager</h1>
      <p className="text-muted-foreground">Kommt als Nächstes.</p>
    </main>
  );
}
```

Create `src/routes/modules/ShiftsPlaceholder.tsx`:
```tsx
export function ShiftsPlaceholder() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Schichten</h1>
      <p className="text-muted-foreground">Kommt als Nächstes.</p>
    </main>
  );
}
```

- [ ] **Step 5: Routen in `App.tsx` definieren**

Create `src/App.tsx`:
```tsx
import { Routes, Route } from "react-router-dom";
import { Cockpit } from "@/routes/Cockpit";
import { ChecklistsPlaceholder } from "@/routes/modules/ChecklistsPlaceholder";
import { TillPlaceholder } from "@/routes/modules/TillPlaceholder";
import { InventoryPlaceholder } from "@/routes/modules/InventoryPlaceholder";
import { ShiftsPlaceholder } from "@/routes/modules/ShiftsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cockpit />} />
      <Route path="/checklists" element={<ChecklistsPlaceholder />} />
      <Route path="/till" element={<TillPlaceholder />} />
      <Route path="/inventory" element={<InventoryPlaceholder />} />
      <Route path="/shifts" element={<ShiftsPlaceholder />} />
    </Routes>
  );
}
```

- [ ] **Step 6: `main.tsx` auf Router umstellen**

Ersetze den Render-Teil in `src/main.tsx` durch:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 7: Tests + Sichtprüfung**

Run: `npm test`
Expected: PASS (alle Tests grün).
Run: `npm run tauri dev`
Expected: Cockpit mit 4 Kacheln; Klick auf eine Kachel öffnet die Platzhalter-Seite. Fenster schließen.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: cockpit home screen with four module tiles and routing"
```

---

## Task 8: SQLite anbinden (tauri-plugin-sql + Migration)

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`
- Create: `package.json`-Eintrag über npm (JS-Seite des Plugins)

- [ ] **Step 1: Plugin (Rust) hinzufügen**

In `src-tauri/Cargo.toml` unter `[dependencies]` ergänzen:
```toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

- [ ] **Step 2: Plugin (JS) hinzufügen**

Run: `npm install @tauri-apps/plugin-sql`

- [ ] **Step 3: Migration + Plugin-Registrierung in `lib.rs`**

In `src-tauri/src/lib.rs` die `run()`-Funktion so anpassen, dass das SQL-Plugin mit einer Migration registriert wird:
```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_settings_table",
        sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:assistmybiz.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
(Vorhandene Plugins/Builder-Aufrufe beibehalten und ergänzen, nicht ersetzen.)

- [ ] **Step 4: Berechtigung freischalten**

In `src-tauri/capabilities/default.json` im `permissions`-Array ergänzen:
```json
"sql:default",
"sql:allow-execute",
"sql:allow-select"
```

- [ ] **Step 5: Build-Prüfung**

Run: `npm run tauri dev`
Expected: App startet ohne Rust-Compile-Fehler; beim ersten Start wird die SQLite-Datei angelegt. Fenster schließen.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire up tauri-plugin-sql with settings migration"
```

---

## Task 9: DB-Wrapper (getSetting/setSetting) — TDD

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

- [ ] **Step 1: Failing Test schreiben (Tauri-SQL gemockt)**

Create `src/lib/db.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { getSetting, setSetting } from "./db";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("getSetting", () => {
  it("returns null when no row exists", async () => {
    select.mockResolvedValue([]);
    expect(await getSetting("shopName")).toBeNull();
  });

  it("returns the stored value when a row exists", async () => {
    select.mockResolvedValue([{ value: "Cafe Sonne" }]);
    expect(await getSetting("shopName")).toBe("Cafe Sonne");
  });
});

describe("setSetting", () => {
  it("upserts the key/value pair", async () => {
    execute.mockResolvedValue(undefined);
    await setSetting("shopName", "Cafe Sonne");
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO settings/i);
    expect(params).toEqual(["shopName", "Cafe Sonne"]);
  });
});
```

- [ ] **Step 2: Test ausführen → soll fehlschlagen**

Run: `npm test`
Expected: FAIL („Cannot find module './db'").

- [ ] **Step 3: Wrapper implementieren**

Create `src/lib/db.ts`:
```ts
import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:assistmybiz.db");
  }
  return dbPromise;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}
```

- [ ] **Step 4: Test ausführen → soll bestehen**

Run: `npm test`
Expected: PASS (alle db-Tests grün).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add typed SQLite settings wrapper (getSetting/setSetting)"
```

---

## Task 10: End-to-End-Rauchtest (Persistenz sichtbar in der echten App)

**Files:**
- Modify: `src/routes/Cockpit.tsx` (kleiner Persistenz-Nachweis)

- [ ] **Step 1: Persistenz-Nachweis in Cockpit einbauen**

Erweitere `src/routes/Cockpit.tsx`: Lade beim Mounten den Wert `lastOpened`, schreibe einen neuen Zeitstempel und zeige den vorigen an. Ersetze die Komponente durch:
```tsx
import { useEffect, useState } from "react";
import { MODULES } from "@/config/modules";
import { ModuleTile } from "@/components/ModuleTile";
import { getSetting, setSetting } from "@/lib/db";

export function Cockpit() {
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const previous = await getSetting("lastOpened");
      if (active) setLastOpened(previous);
      await setSetting("lastOpened", new Date().toISOString());
    })().catch(() => {/* in v1 still: Persistenz ist optional fürs Rendern */});
    return () => { active = false; };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laden-Cockpit</h1>
        <p className="text-muted-foreground">
          {lastOpened ? `Zuletzt geöffnet: ${new Date(lastOpened).toLocaleString("de-AT")}` : "Willkommen!"}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <ModuleTile key={m.id} title={m.title} description={m.description} path={m.path} icon={m.icon} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Cockpit-Test an gemockte DB anpassen**

Oben in `src/routes/Cockpit.test.tsx` vor den Imports ergänzen, damit der jsdom-Test die Tauri-DB nicht real aufruft:
```tsx
import { vi } from "vitest";
vi.mock("@/lib/db", () => ({
  getSetting: vi.fn(async () => null),
  setSetting: vi.fn(async () => {}),
}));
```

- [ ] **Step 3: Tests ausführen**

Run: `npm test`
Expected: PASS (alle Tests grün, inkl. Cockpit).

- [ ] **Step 4: Manueller End-to-End-Nachweis**

Run: `npm run tauri dev`
Expected (1. Start): Untertitel „Willkommen!". App schließen, erneut `npm run tauri dev`.
Expected (2. Start): Untertitel „Zuletzt geöffnet: <Datum/Uhrzeit>" → **beweist Persistenz über SQLite**. Fenster schließen.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: prove SQLite persistence on cockpit (lastOpened)"
```

---

## Task 11: Abschluss — Version taggen & pushen

**Files:** keine

- [ ] **Step 1: Volltest**

Run: `npm test`
Expected: alle Tests grün.

- [ ] **Step 2: Tag setzen & pushen** (gemäß Projekt-Workflow: immer mit Versions-Tag)

```bash
git tag -a v0.2.0 -m "v0.2.0 — Fundament (walking skeleton)"
git push --follow-tags
```
Expected: `main` und Tag `v0.2.0` landen auf `origin` (github.com/timosmd/AssistMyBiz).

---

## Definition of Done

- `npm run tauri dev` startet ein Fenster mit dem **Cockpit** (4 Kacheln, freundliches Design).
- Klick auf eine Kachel öffnet die jeweilige **Platzhalter-Seite**.
- **Persistenz** über SQLite ist nachgewiesen (Untertitel „Zuletzt geöffnet …" beim 2. Start).
- `npm test` ist grün (Module-Descriptors, ModuleTile, Cockpit, DB-Wrapper, Sanity).
- Stand ist als **`v0.2.0`** getaggt und gepusht.
```
