# Schichten-Modul — Design (Spec)

> Modul 4 von 4 des Laden-Cockpits. Setzt §6.4 der Gesamt-Spec
> (`2026-05-30-laden-cockpit-design.md`) um. Gestaffelt in zwei lieferbare Pläne.

## 1. Ziel in einem Satz

Kleinen Läden einen schnellen, druckbaren **Wochen-Dienstplan** geben — mit
Stundensummen, Auslastung (Soll/Ist), Urlauben und unverbindlichen
Arbeitszeit-Warnungen — rein lokal, ohne Cloud.

## 2. Leitprinzipien (aus der Gesamt-Spec)

- **Rein lokal**: alle Mitarbeiter-/Plandaten bleiben in der lokalen SQLite-DB.
- **Einfach & schön**: selbsterklärendes Klick-Raster, keine Schulung nötig.
- **Unverbindlich**: Arbeitszeit-Warnungen sind Hinweise, **keine Rechtsberatung**
  (AGB-Klarstellung). Keine harte Blockade von Eingaben.
- **YAGNI**: kein Auto-Planen, keine volle AZG/ARG-Engine in v1 (das ist v2/„Pro").

## 3. Aufteilung in Pläne

### Plan 1 — Mitarbeiter, Vorlagen & Wochenplan (Tag `v0.11.0`)
Der nutzbare Kern: Mitarbeiter anlegen, Schicht-Vorlagen, das Wochen-Raster mit
Klick-Bearbeitung, Stundensummen und Auslastung je Mitarbeiter.

### Plan 2 — Urlaube, Warnungen & Druck (Tag `v0.12.0`)
Urlaubszeiträume, einfache AZG/ARG-Warnungen, druckbare Aushang-Ansicht.

Jeder Plan liefert für sich lauffähige, getestete Software. Diese Spec
beschreibt beide; die Implementierungspläne werden einzeln geschrieben.

## 4. Datenmodell (neue SQLite-Migrationen)

Geld-/Zeitkonventionen: Uhrzeiten als `"HH:MM"`-Text (24h). Datum als ISO
`"YYYY-MM-DD"`. Stunden werden **berechnet**, nie gespeichert (single source of truth
= start/ende). snake_case in der DB, camelCase in TS — wie im restlichen Projekt.

**Migration v7 (Plan 1):**

- `employees`
  - `id` INTEGER PK
  - `name` TEXT NOT NULL
  - `wochenstunden` REAL NOT NULL DEFAULT 0  — Wochen-Soll (z.B. 38.5); 0 = ohne Soll
  - `farbe` TEXT — Hex/Tailwind-Token für farbige Chips (nullable)
  - `aktiv` INTEGER NOT NULL DEFAULT 1  — deaktivierte erscheinen nicht im Plan
  - `erstellt_am` TEXT NOT NULL

- `shift_presets`
  - `id` INTEGER PK
  - `name` TEXT NOT NULL  (z.B. „Früh")
  - `start` TEXT NOT NULL  („08:00")
  - `ende` TEXT NOT NULL  („14:00")
  - `erstellt_am` TEXT NOT NULL
  - Seeds: *Früh 08:00–14:00*, *Spät 14:00–20:00*.

- `shifts`
  - `id` INTEGER PK
  - `employee_id` INTEGER NOT NULL  (FK employees.id, ON DELETE CASCADE)
  - `datum` TEXT NOT NULL  (ISO-Tag)
  - `start` TEXT NOT NULL
  - `ende` TEXT NOT NULL
  - `erstellt_am` TEXT NOT NULL
  - **v1-Regel:** höchstens **ein** Eintrag pro `(employee_id, datum)`. Das UI
    ersetzt einen bestehenden Eintrag beim Speichern (kein Split-Dienst in v1).

**Migration v8 (Plan 2):**

- `vacations`
  - `id` INTEGER PK
  - `employee_id` INTEGER NOT NULL  (FK, ON DELETE CASCADE)
  - `von` TEXT NOT NULL  (ISO-Tag, inklusive)
  - `bis` TEXT NOT NULL  (ISO-Tag, inklusive)
  - `erstellt_am` TEXT NOT NULL

## 5. Reine Logik (gut testbare Module, keine DB/IO)

- `src/features/shifts/week.ts`
  - `weekDays(date: Date): string[]` → 7 ISO-Tage Mo…So der ISO-Woche von `date`.
  - `weekLabel(date: Date): string` → z.B. „KW 23 · 02.–08.06.2026".
  - `addWeeks(date: Date, n: number): Date`.
  - (ISO-Wochenlogik analog zu `features/checklists/period.ts`, Donnerstag-Pivot.)

- `src/features/shifts/hours.ts`
  - `shiftHours(start: string, ende: string): number` → Dezimalstunden;
    `ende <= start` → 0 (kein Über-Nacht in v1).
  - `sumHours(shifts: {start; ende}[]): number`.
  - `auslastung(ist: number, soll: number): { ist; soll; diff }` — `diff>0` =
    Überstunden, `diff<0` = freie Stunden, `soll===0` = ohne Bewertung.

- `src/features/shifts/warnings.ts` *(Plan 2)*
  - `weekWarnings(perEmployee): Warning[]` mit Regeln:
    1. Tagesarbeitszeit > 10 h.
    2. Wochenarbeitszeit > 50 h.
    3. Tägliche Ruhezeit < 11 h (Ende Tag N → Start Tag N+1).
    4. Kein freier Tag in der Woche (≥1 dienstfreier Kalendertag empfohlen).
  - Reine Funktion über die geplanten Schichten einer Woche; liefert
    Liste von `{ employeeId, regel, text }`. Keine Eingabe-Blockade.

## 6. Datenzugriff (TS, gemockt testbar)

`src/lib/db/`:
- `employees.ts`: `listEmployees(includeInactive?)`, `addEmployee`, `updateEmployee`,
  `setEmployeeActive`, `deleteEmployee`.
- `shiftPresets.ts`: `listPresets`, `addPreset`, `updatePreset`, `deletePreset`.
- `shifts.ts`: `listShiftsForWeek(isoDays: string[])`, `upsertShift(employeeId, datum, start, ende)`
  (löscht vorhandenen Tag-Eintrag und legt neu an → „ein Eintrag pro Tag"), `deleteShift(id)`.
- *(Plan 2)* `vacations.ts`: `listVacations`, `addVacation`, `deleteVacation`,
  `vacationDaysInRange(isoDays)` (für die Plan-Darstellung).

Alle nutzen den geteilten `getDb()`-Singleton (`src/lib/db/connection.ts`).

## 7. UI-Komponenten (Route `/shifts`, `ShiftModule`)

Tabs: **Plan · Mitarbeiter · Vorlagen** *(Plan 2 ergänzt: **Urlaube**)*. `BackLink`
zum Cockpit wie in den anderen Modulen.

**Mitarbeiter-Tab** (`MitarbeiterView`):
- `EmployeeForm`: Name, Wochen-Soll (Stunden), Farbe (kleine Palette).
- `EmployeeList`: Zeilen mit Bearbeiten, Aktiv-Schalter, Löschen.

**Vorlagen-Tab** (`PresetView`):
- Kleine CRUD-Liste: Name + Start–Ende. Anlegen/Bearbeiten/Löschen.

**Plan-Tab** (`WochenplanView`):
- Wochen-Navigation: ‹ `weekLabel` › + „Heute".
- Raster: Zeilen = aktive Mitarbeiter, Spalten = Mo…So (`weekDays`).
- Zelle zeigt Vorlage-/Zeit-Chip (Mitarbeiterfarbe) oder leer.
- Klick auf Zelle → `ShiftCellEditor` (Popover/Modal): Vorlage wählen (füllt
  Zeiten vor) **oder** freie Zeiten eintippen → Speichern (`upsertShift`) /
  Löschen (`deleteShift`).
- Rechte Spalte je Zeile: Wochenstunden + Auslastungs-Badge
  („34 / 38,5 h · 4,5 h frei" bzw. „+3 h Über").
- *(Plan 2)* Urlaubstage erscheinen als „Urlaub"-Zelle; Warn-Hinweise je Zeile +
  Banner „keine Rechtsberatung"; **Drucken**-Button (Browser-Print der Ansicht).

## 8. Fehlerbehandlung

- Datenzugriffsfehler → freundliche Inline-Meldung je View („… konnte nicht
  geladen/gespeichert werden."), kein Absturz (Muster wie ArticleList/HeuteRunCard).
- Ungültige Zeit (`ende <= start`) → `shiftHours` = 0; der Editor weist anhand
  einer kleinen Hinweiszeile darauf hin, blockiert aber nicht hart.
- Löschen eines Mitarbeiters entfernt dessen Schichten (FK CASCADE).

## 9. Test-Strategie

- **Reine Module** (`week`, `hours`, `warnings`): umfangreiche Unit-Tests
  (ISO-Wochengrenzen, Jahreswechsel, Dauer-/Auslastungsfälle, jede Warn-Regel).
- **Datenschichten**: `@tauri-apps/plugin-sql` gemockt — SQL/Params geprüft,
  inkl. „upsert ersetzt Tag-Eintrag".
- **Views**: Testing Library — Anlegen, Zelle bearbeiten, Summen/Badges,
  Wochen-Navigation, Leerzustände.

## 10. Bewusst NICHT in v1 (YAGNI)

- Automatisches Einplanen / Schichttausch-Vorschläge.
- Über-Nacht-Schichten, mehrere Schichten pro Tag (Split-Dienst).
- Vollständige AZG/ARG-Engine (nur 4 einfache Hinweis-Regeln).
- Monats-/Jahresansicht, Lohnkosten, Zeiterfassung (Ist-Stempelung).
