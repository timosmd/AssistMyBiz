# In-App Bug-Reporter — Design-Dokument

**Datum:** 2026-05-31
**Status:** Freigegeben (Kurz-Brainstorming)
**Teil von:** Laden-Cockpit

---

## 1. Ziel

Ein kleines, eingebautes Werkzeug, um beim Entwickeln/Testen schnell einen Bug zu
melden — mit Beschreibung, Priorität und automatisch angehängtem Log. Die Reports
landen als Dateien im Projektordner, damit **Claude sie direkt auslesen** kann.

## 2. Leitentscheidung: rein lokales Dev-Werkzeug (Variante A)

Die App ist bewusst **rein lokal**. Der Bug-Reporter ist daher ein **Entwickler-
Werkzeug**: nur im **Dev-Build** aktiv (`import.meta.env.DEV`), in der ausgelieferten
Kundenversion **aus**. Reports verlassen das Gerät nie → kein Datenschutz-Problem.

**Zukunftssicher für später (Variante B, Kunden-Reports):** Das Wohin-geht-der-Report
ist hinter einer **Sink-Schnittstelle** gekapselt. v1 = `FileSink` (lokal). Eine
spätere `RemoteSink` (Endpoint/E-Mail) lässt sich ergänzen, ohne FAB/Modal/Log zu ändern.

## 3. Bestandteile & Verhalten

**FAB (Floating Action Button):**
- Global in der App-Hülle (auf allen Screens), unten rechts.
- Eine unsichtbare Hover-Zone in der Ecke; der FAB **wird erst beim Hovern sichtbar**
  (sanftes Ein-/Ausblenden), sonst unauffällig.
- Nur im Dev-Build gerendert.

**Modal:**
- Felder: **Beschreibung** (Textarea, Pflicht), **Priorität** (Niedrig/Mittel/Hoch/Kritisch).
- Aktion „Senden" → schreibt den Report, zeigt kurze Bestätigung, schließt.
- Validierung: leere Beschreibung blockiert das Senden mit sichtbarem Hinweis.

**Log-Puffer:**
- Ein **Ring-Puffer** der letzten ~100 Einträge (FIFO, feste Obergrenze).
- Quellen: `console.error` / `console.warn` (gepatcht, leiten zusätzlich in den Puffer)
  und ein paar **Schlüssel-Aktionen** (Routenwechsel, „Beleg gespeichert" o. Ä.) über
  eine kleine `logEvent(msg)`-Funktion.
- Beim Report wird der aktuelle Puffer angehängt.

**Kontext (automatisch):** aktuelle Route, App-Version (aus `package.json`/Tauri),
Betriebssystem, Zeitstempel.

## 4. Speicherung (FileSink)

- Beim „Senden" ruft das Frontend einen **Rust-Command** `write_bug_report(report)` auf.
- Rust schreibt eine **Markdown-Datei** nach `<Projektordner>/bug-reports/`:
  Dateiname `YYYY-MM-DD_HH-MM-SS_<prio>.md`.
- Projektordner-Pfad zur Compile-Zeit über `env!("CARGO_MANIFEST_DIR")` (= `src-tauri/`)
  + `..` → Repo-Wurzel. Funktioniert im Dev-Modus auf dem Entwicklungsrechner.
- Format:
  ```markdown
  ---
  zeit: 2026-05-31T22:10:00
  prio: Hoch
  route: /till
  version: 0.3.0
  os: windows
  ---

  ## Beschreibung
  <Text>

  ## Log
  <Ring-Puffer-Zeilen>
  ```
- `bug-reports/` wird in `.gitignore` aufgenommen (Reports sind lokal, nicht versioniert).

## 5. Dateistruktur

```
src/features/bugreport/
  BugReportFab.tsx        # FAB + Hover-Zone (nur DEV)
  BugReportModal.tsx      # Formular + Validierung
  logBuffer.ts            # Ring-Puffer + logEvent + console-Patch (rein testbar)
  formatReport.ts         # reine Funktion: Report-Objekt -> Markdown-String
  sink.ts                 # reportSink(report) -> FileSink (ruft Rust-Command)
src-tauri/src/
  bugreport.rs            # write_bug_report-Command (+ pfad-Helfer)
```
Eingehängt in die App-Hülle (in `App.tsx` oder ein Layout, das alle Routen umschließt).

## 6. Tests

- `logBuffer`: Ring-Verhalten (Obergrenze, FIFO), `logEvent` schreibt, console-Patch leitet um.
- `formatReport`: reine Funktion → korrekter Markdown (Frontmatter + Abschnitte).
- `BugReportModal`: leere Beschreibung blockiert; gültiger Report ruft Sink genau einmal.
- Rust: Pfad-/Dateinamen-Helfer (reine Funktionen) per Unit-Test.

## 7. Bewusst NICHT in v1

- Kunden-/Remote-Versand (Variante B), Screenshots, automatischer Stacktrace-Symbolik,
  Bug-Verwaltung/Statusliste in der App. (FileSink + Markdown reicht; ich lese die Dateien.)

## 8. Offene Punkte für die Planung

- Genaues Abgreifen der App-Version (Tauri-API vs. eingebettete Konstante).
- Hover-Zonen-Größe/Animation final (beim Design-Skill).
