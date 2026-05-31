# Modul „Checklisten" — Design-Dokument

**Datum:** 2026-05-31
**Status:** Freigegeben (Kurz-Brainstorming)
**Teil von:** Laden-Cockpit (Produkt-Spec §6.1)
**Inspiration:** Vorlage→Instanz-Konzept aus „Timos Assistent / cto-assistant" (stark vereinfacht)

---

## 1. Ziel

Das vierte Cockpit-Modul: wiederkehrende Aufgaben (Öffnen, Schließen, Wöchentliches)
als **Checklisten** abhaken — mit automatischem Zurücksetzen je Periode und einer
**Historie als Nachweis** (mit Zeitstempel). Rein lokal, selbsterklärend.

## 2. Kernkonzept: Vorlage → Durchführung

Übernommen (vereinfacht) vom Checklisten-Generator des CTO-Tools:

- **Vorlage (Template):** wiederverwendbare Liste — Name, **Frequenz** (täglich/wöchentlich),
  eine **flache Liste von Punkten** (nur Text). Editierbar.
- **Durchführung (Run/Instanz):** pro **Periode** (Tag bzw. Kalenderwoche) eine konkrete
  Durchführung, die die Vorlage beim Start **einfriert** (Snapshot) → spätere
  Vorlagen-Änderungen verfälschen alte Nachweise nicht. Punkte abhaken, optional Notiz,
  **„Abschließen"** setzt einen Zeitstempel.
- **Auto-Reset:** neue Periode → frische Durchführung; die alte bleibt als Nachweis.
- **Historie:** abgeschlossene/offene Durchführungen je Periode, mit Zeitstempel.

**Bewusst NICHT (zu industriell):** dynamische Kopf-Felder, Mess-Typen, Unterpunkte,
N/A-Markierung, Word-Export, JSON-Import, Reopen, Rollen/Rechte, Push-Erinnerungen.

## 3. Aufbau & Einordnung

Route **`/checklists`** (ersetzt `ChecklistsPlaceholder`) → Tabs **Heute** · **Vorlagen** ·
**Historie**, + Zurück-zum-Cockpit-Link. Folgt dem `TillModule`/`InventoryModule`-Muster.

## 4. Datenmodell (SQLite)

**Migration v5 — Vorlagen (Plan 1):**
```sql
CREATE TABLE checklist_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  frequenz TEXT NOT NULL DEFAULT 'taeglich',   -- 'taeglich' | 'woechentlich'
  items_json TEXT NOT NULL DEFAULT '[]',        -- [{ "id": "...", "label": "..." }]
  erstellt_am TEXT NOT NULL
);
-- Seed: Öffnen (täglich), Schließen (täglich), Wöchentlich (wöchentlich) mit Beispiel-Punkten.
```

**Migration v6 — Durchführungen (Plan 2):**
```sql
CREATE TABLE checklist_runs (
  id INTEGER PRIMARY KEY,
  template_id INTEGER REFERENCES checklist_templates(id) ON DELETE SET NULL,
  periode TEXT NOT NULL,            -- "2026-05-31" (täglich) | "2026-W22" (wöchentlich)
  snapshot_json TEXT NOT NULL,      -- eingefrorene { name, frequenz, items:[{id,label}] }
  item_states_json TEXT NOT NULL DEFAULT '{}',  -- { "<itemId>": true }
  notiz TEXT,
  erstellt_am TEXT NOT NULL,
  abgeschlossen_am TEXT,
  UNIQUE(template_id, periode)
);
```

## 5. Reine Logik

- `currentPeriod(frequenz, date): string` — täglich → ISO-Datum `YYYY-MM-DD`; wöchentlich →
  ISO-Woche `YYYY-Www` (z. B. „2026-W22"). Rein, getestet.
- `runProgress(itemStates, items): { done, total }` — Anzahl erledigter Punkte.

## 6. Datenzugriff

- **`templates.ts`** (Plan 1): `listTemplates`, `addTemplate(name, frequenz, items)`,
  `updateTemplate(id, name, frequenz, items)`, `deleteTemplate(id)`. (`items_json` ↔ `items[]`.)
- **`runs.ts`** (Plan 2): `getRun(templateId, periode)`, `createRunFromTemplate(template, periode)`
  (Snapshot), `setItemState(runId, itemId, done)`, `completeRun(runId)`, `listRuns()` (Historie,
  neueste zuerst).

## 7. UI-Verhalten

- **Vorlagen-Tab (Plan 1):** Liste der Vorlagen; **anlegen/bearbeiten** (Name, Frequenz,
  Punkte hinzufügen/entfernen/umbenennen) · **löschen**.
- **Heute-Tab (Plan 2):** für jede Vorlage, deren aktuelle Periode ansteht, die laufende
  Durchführung als **Checkbox-Liste** (Fortschritt x/y), Notiz, **„Abschließen"**. Beim ersten
  Abhaken wird die Durchführung der Periode lazy erzeugt.
- **Historie-Tab (Plan 2):** Durchführungen je Periode (neueste zuerst) mit Zeitstempel,
  Status (offen/abgeschlossen) und Fortschritt — der Nachweis.

## 8. Tests

- **Rein:** `currentPeriod` (Tag/Woche, Jahreswechsel-Kante), `runProgress`.
- **Datenzugriff:** gemockt (wie bestehende `db`-Module); JSON-(De)Serialisierung der Items/States.
- **Komponenten:** Vorlagen-Editor (anlegen/Punkte/Validierung), Durchführung (abhaken →
  `setItemState`, abschließen), Historie-Liste, Modul-Tabs.

## 9. Bau-Reihenfolge (zwei Pläne)

1. **Plan 1 — Vorlagen:** Migration v5 + Seeds, `templates.ts`, Vorlagen-Editor, Modul-Hülle
   (`ChecklistModule` mit Tabs; Heute/Historie als „bald"-Platzhalter), Route. → `v0.8.0`
2. **Plan 2 — Durchführung + Historie:** Migration v6, `runs.ts`, `currentPeriod`/`runProgress`,
   Heute-Tab (abhaken/abschließen), Historie-Tab. → `v0.9.0`

## 10. Datenschutz / Recht

- Reine Aufgaben-/Nachweis-Daten, **keine personenbezogenen Daten**. 100 % lokal.
