# Modul „Tageskasse & Belege" — Design-Dokument

**Datum:** 2026-05-31
**Status:** Entwurf zur Freigabe
**Teil von:** Laden-Cockpit (siehe `2026-05-30-laden-cockpit-design.md`, Abschnitt 6.2)
**Markt:** Österreich

---

## 1. Ziel

Das zweite Modul des Laden-Cockpits. Es nimmt dem Laden den täglichen Geld- und
Beleg-Kleinkram ab: Belege sammeln & ordnen, Kasse zählen, auswerten und sauber
für den Steuerberater exportieren. **Rein lokal**, kein personenbezogenes Risiko
für den Anbieter.

**Wichtige Grenze (AT):** Dies ist **keine Registrierkasse** im Sinne der RKSV,
sondern ein **Beleg-Sammler & Steuerberater-Vorbereitungstool**. Diese
Positionierung muss in der UI sichtbar bleiben.

## 2. Umfang (v1, bewusst flach pro Teil)

Alles wird in diesem Bau umgesetzt, jeder Teil aber auf das Nötigste begrenzt:

1. **Belege** — erfassen (PC-Upload/Drag&Drop/Scanner-Datei **und** Handy-Scanner),
   Liste, Suchen/Filtern, Ansehen, Löschen.
2. **Tageskasse** — Stückelungs-Zähler (Euro) → Live-Summe (Ist), Soll/Umsatz,
   Differenz, Tagesabschluss (einer pro Datum).
3. **Auswertung** — Dashboard (Umsatz-Verlauf, Belege je Kategorie, Monatssummen)
   + Monats-/Jahres-**Export** für den Steuerberater.
4. **Handy-Scanner** — QR-Pairing im lokalen WLAN, Foto Handy→PC.

**v1 NICHT:** echte Registrierkasse/RKSV, Buchhaltungslogik, Steuerberechnung,
Kassen-Schnittstelle, OCR/automatische Belegerkennung, Mehrbenutzer/Rollen.

## 3. Aufbau & Einordnung

Die Route **`/till`** (bisher `TillPlaceholder`) wird zur Modul-Hülle mit drei Tabs:
**Belege · Tageskasse · Auswertung**.

**Frontend-Struktur** (kleine, fokussierte Dateien):

```
src/routes/till/TillModule.tsx        # Hülle + Tab-Navigation
src/features/receipts/
  ReceiptList.tsx · ReceiptForm.tsx · ReceiptCard.tsx · useReceipts.ts
src/features/till/
  CashCounter.tsx · DailyClose.tsx
src/features/dashboard/
  Dashboard.tsx · charts/* · export.ts
src/features/scanner/
  ScanButton.tsx · ScanSession.ts   # Frontend-Seite des Pairings
src/lib/db/
  receipts.ts · cashCounts.ts · categories.ts   # typisierte Zugriffe auf db.ts
```

- Diagramme: **Recharts** (schlank, React-nah).
- Geldbeträge im Frontend als ganze **Cent (number)**, Formatierung an der Anzeige.

## 4. Datenmodell (SQLite, Migration v2)

Beträge als **ganze Cent (INTEGER)** — keine Fließkomma-Fehler.

```sql
-- Kategorien (vorbefüllt, erweiterbar)
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Belege
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY,
  datum TEXT NOT NULL,             -- ISO-Datum (YYYY-MM-DD)
  betrag_cent INTEGER NOT NULL,
  kategorie_id INTEGER REFERENCES categories(id),
  notiz TEXT,
  datei_pfad TEXT,                 -- relativ zu <AppData>/receipts/
  datei_typ TEXT,                  -- 'jpg' | 'png' | 'pdf'
  erstellt_am TEXT NOT NULL
);

-- Tagesabschluss (einer pro Datum)
CREATE TABLE daily_close (
  id INTEGER PRIMARY KEY,
  datum TEXT NOT NULL UNIQUE,      -- ISO-Datum
  gezaehlt_cent INTEGER,           -- Ist (aus Stückelung)
  soll_cent INTEGER,               -- Soll
  umsatz_cent INTEGER,             -- Tagesumsatz
  notiz TEXT,
  erstellt_am TEXT NOT NULL
);
```

**Kategorien-Startliste (AT):** Wareneinkauf, Miete, Betriebskosten, Büromaterial,
Marketing, Sonstiges (`is_default = 1`). Eigene Kategorien sind ergänzbar.

## 5. Belege erfassen & Dateispeicherung

- Import-Wege: **Datei-Auswahl**, **Drag & Drop**, **Handy-Scanner** (jpg/png/pdf).
- Beim Import wird die Datei **in einen verwalteten App-Ordner kopiert**:
  `<AppDataDir>/receipts/<jahr>/<uuid>.<ext>`. In der DB steht nur der **relative
  Pfad**. → Das Original darf verschwinden; Backup/Export bleiben vollständig.
- Dateizugriff (Kopieren, Lesen, Pfade) über **`tauri-plugin-fs`**.
- Beleg-Formular: Betrag (Pflicht), Kategorie (Pflicht, Default „Sonstiges"),
  Datum (Default heute), Notiz (optional), Datei (optional).

## 6. Tageskasse

- **Stückelungs-Raster** (Euro): Scheine 500/200/100/50/20/10/5, Münzen
  2 €/1 €/50/20/10/5/2/1 ct. Anzahl je Stückelung → **Live-Summe (Ist)**.
- Eingabe **Soll** und/oder **Tagesumsatz** → **Differenz** sichtbar (z. B. „Kassendifferenz −2,30 €").
- **Tagesabschluss** speichern: ein Datensatz pro Datum; am selben Tag editierbar.

## 7. Auswertung — Dashboard + Export

**Dashboard:**
- Umsatz-Verlauf (Linie/Balken über Zeit, aus `daily_close.umsatz_cent`)
- Belege-Summe je Kategorie (Balken/Donut)
- Monatssummen-Kacheln (Umsatz, Ausgaben gesamt)

**Export (Steuerberater-Vorbereitung):**
- Nutzer wählt **Monat oder Jahr** → Speicher-Dialog für Zielordner.
- Erzeugt einen Ordner mit:
  - **Kopien aller Belege** des Zeitraums, benannt `YYYY-MM-DD_Kategorie_Betrag.<ext>`
  - **`index.csv`** (Spalten: Datum; Kategorie; Betrag; Notiz; Dateiname) —
    Trennzeichen `;`, **Dezimalkomma** (AT/Excel-tauglich)
  - **`zusammenfassung.txt`** (Summen je Kategorie + Gesamt + Zeitraum)
- Der CSV-/Zusammenfassungs-Builder ist eine **reine Funktion** (gut testbar),
  getrennt vom Datei-Schreiben.

## 8. Handy-Scanner (lokales WLAN)

Riskantester Teil → hinter einer klaren **„Scan-Session"-Schnittstelle** gekapselt.

- **Rust-Kern** startet **nur während des Scannens** einen winzigen lokalen
  HTTP-Server, gebunden an die LAN-IP, auf einem Port.
- App zeigt einen **QR-Code** mit `http://<lan-ip>:<port>/scan?token=<einmal>`.
- Das **Handy** (gleiches WLAN) scannt → öffnet eine **schlanke Handy-Webseite**
  (vom App-Server ausgeliefert) → Foto aufnehmen/wählen → **POST zurück an die App**.
- Die App empfängt die Datei, legt sie als **Beleg-Entwurf** an (Betrag/Kategorie
  ergänzt der Nutzer am PC).
- **Token einmalig & kurzlebig**; der Server läuft **nur beim Pairing** und wird
  danach geschlossen.
- **Windows-Firewall** fragt evtl. beim ersten Mal („in privaten Netzen erlauben") —
  wird dokumentiert; klare In-App-Hilfe.

## 9. Tests

- **Reine Logik (Unit):** Cent-/Summen-Berechnung (Stückelung, Differenz),
  CSV-/Zusammenfassungs-Builder, Datei-Benennung, Kategorie-Logik.
- **Daten-Zugriffsmodule:** gemockt wie das bestehende `db.test.ts`.
- **Komponenten:** Kassensumme live, Beleg-Formular-Validierung, Listen-Filter.
- **Scanner:** Token-/Session-Logik und Datei-Handling testbar; der Netzwerk-Pfad
  wird manuell integrationsgetestet.

## 10. Bau-Reihenfolge

Auch wenn „alles" gebaut wird, in sicherer, je getesteter Reihenfolge:

1. Datenmodell (Migration v2) + Kategorien-Seed + Daten-Zugriffsmodule
2. Belege-UI (Erfassen per PC, Liste, Suchen/Filtern, Ansehen, Löschen)
3. Tageskasse (Stückelungs-Zähler + Tagesabschluss)
4. Dashboard
5. Export
6. Handy-Scanner (zuletzt, isoliert)

→ Beim `writing-plans` voraussichtlich **zwei Pläne**: **Kern (1–5)** und
**Handy-Scanner (6)**.

## 11. Datenschutz / Recht (AT)

- Belege können personenbezogene Daten enthalten (z. B. Lieferantennamen), bleiben
  aber **100 % lokal** → konsistent mit der Datenschutz-Haltung des Cockpits.
- **Keine Registrierkasse** (RKSV): in der UI als Vorbereitungs-/Sammeltool kennzeichnen.

## 12. Offene Punkte für die Implementierungsplanung

- Wahl/Pinning der konkreten Rust-HTTP-Server-Crate für den Scanner.
- Genaues QR-/Token-Format und Port-Strategie (fest vs. ephemer).
- Recharts-Diagrammtypen final festlegen (beim Design-Skill).
- `tauri-plugin-fs` Capability-Berechtigungen (Lese-/Schreibpfade) minimal halten.
