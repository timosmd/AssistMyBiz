# Laden-Cockpit — Design-Dokument

**Datum:** 2026-05-30
**Status:** Entwurf zur Freigabe
**Markt:** Österreich (kleine Läden, Fußgängerzone)

---

## 1. Idee in einem Satz

Eine schlanke, schöne Windows-App, die kleinen Läden den täglichen Kleinkram hinter
der Theke abnimmt (Checklisten, Tageskasse & Belege, Lager, Schichten) — rein lokal,
datenschutzfreundlich, im monatlichen Abo.

## 2. Leitprinzipien (nicht verhandelbar)

1. **Rein lokal:** Geschäftsdaten verlassen das Gerät des Kunden nie. Nach außen geht
   nur ein winziger Lizenz-/Update-Ping ("Abo aktiv: ja/nein").
2. **Datenschutz by Design:** Der Anbieter ist reiner Software-Verkäufer, kein
   Verarbeiter der Kund*innen-Daten der Läden.
3. **Selbsterklärend:** Bedienung ohne Schulung. Keine Handbücher nötig.
4. **Schön & freundlich:** Modernes Web-UI, keine "Standard-App"-Optik.
5. **Wartungsarm & günstig:** Keine Cloud für Kundendaten, kein DB-Server,
   minimaler Serverless-Anteil.
6. **Flach in v1:** Jedes Modul bewusst auf das Nötigste begrenzt; Tiefe ist die Falle.

## 3. Zielgruppe

Branchenübergreifend kleine Läden (Gastro, Einzelhandel, Dienstleistung). Universeller
Kern ist die **Tageskasse & Belege** — Geld und Beleg-Chaos hat jeder Laden täglich.

## 4. Produktform

- **Plattform:** Tauri-Desktop-App für **Windows zuerst**; später Tablet/Handy aus
  derselben Web-Codebasis.
- **Startseite ("Cockpit"):** vier große, freundliche Kacheln, je eine pro Modul.
- **Oberfläche:** moderne Web-App (in der Tauri-Hülle) — animiert, selbsterklärend,
  schönes gemeinsames Design-System.

## 5. Architektur

| Baustein | Lösung |
|---|---|
| **Hülle** | Tauri (schlanker Rust-Kern + Web-Frontend) |
| **Oberfläche** | Web-Frontend (moderne Komponenten-Bibliothek + Tailwind o. Ä.) |
| **Daten** | Lokale **SQLite**-Datenbank + Belegfotos als Dateien |
| **Lizenz** | Periodischer Online-Check gegen Mini-Backend; Abrechnung via **Stripe** |
| **Backup** | Automatisch, **verschlüsselt**, in vom Kunden gewählten Ordner (OneDrive/Drive/USB) |
| **Handy-Scanner** | QR-Pairing im lokalen WLAN, Foto direkt Handy→PC (kein Internet) |
| **PC-Upload** | Datei-Upload, Drag & Drop, Bild vom angeschlossenen Scanner |
| **Updates** | Signierter Tauri-Auto-Updater von billigem Static-Host |

**Mini-Backend (Serverless):** genau zwei Aufgaben — (1) Stripe-Abo-Status beantworten,
(2) Update-Infos liefern. **Keine** Geschäftsdaten. Fast null Wartung & Kosten.

### Bezahl-Sperre (sanft & fair)

- App prüft periodisch online "Abo aktiv?". Dazwischen voll offline nutzbar.
- Zahlung überfällig → **Vorwarnung**, **Kulanzfrist**, dann sanfte Sperre.
- Begründung: Im kleinen lokalen Markt, wo sich alle kennen, darf die Sperre kein
  Frust-/Image-Risiko werden.

### Backup-Konzept

- App verschlüsselt Daten **lokal** (nur der Kunde hat den Schlüssel) und legt eine
  Backup-Datei in einen vom Kunden gewählten Ordner. Liegt dieser in OneDrive/Drive,
  ist das Backup automatisch außer Haus — der Anbieter sieht nie etwas.
- Zusätzlich: "Alles exportieren"-Knopf (z. B. fürs Jahresende).

## 6. Module (v1-Umfang)

Die jeweilige **"v1 NICHT"-Zeile schützt den Scope.**

### 6.1 📋 Checklisten
- **v1:** Vorlagen (Öffnen/Schließen/Wöchentlich) + eigene Listen · täglich abhaken ·
  automatisch zurücksetzen · einfache Historie als Nachweis (mit Zeitstempel).
- **v1 NICHT:** Rollen/Rechte, komplexe Zeitpläne, Push-Erinnerungen.

### 6.2 💶 Tageskasse & Belege
- **v1:** Kassenzähl-Helfer (Stückelung → Summe, Soll/Ist) · Tagesumsatz festhalten ·
  Belege erfassen (**Handy-Scan oder PC-Upload/Drag&Drop/Scanner**) mit Betrag +
  Kategorie + Datum · Belege suchen/filtern · **schöne Visualisierung** (kleines
  Dashboard: Umsatz-Verlauf, Bargeld-Trend, Belege je Kategorie) ·
  **Monats-/Jahres-Export** für den Steuerberater (Ordner mit Belegen + CSV).
- **v1 NICHT:** echte Registrierkasse (RKSV), Buchhaltungslogik, Steuerberechnung,
  Kassen-Schnittstelle.
- **Wichtige Grenze:** Positioniert als **Beleg-Sammler & Steuerberater-Vorbereitung**,
  ausdrücklich **keine Registrierkasse** i. S. RKSV — sonst Zertifizierungspflicht.

### 6.3 📦 Lager & Nachbestellen
- **v1:** einfache Artikelliste mit **Mindestbestand** · Bestand +/− oder "fast leer"
  markieren · automatische **Nachbestell-Liste** · optional Lieferant je Artikel ·
  drucken/exportieren.
- **v1 NICHT:** Barcode-Scan, automatischer Abverkauf aus der Kasse, Lieferanten-
  Bestellung per Mail/EDI.

### 6.4 🗓️ Schichten (gestaffelt)
- **v1:** Mitarbeiter anlegen · **Drag-&-Drop-Wochenplan** · **Auslastung** (freie
  Stunden, Überstunden) · **Urlaube** · **einfache** Ruhezeit-/Höchstzeit-Warnungen ·
  Stundensumme je Mitarbeiter/Woche · druckbar zum Aushängen.
- **v2 (später):** vollständige **AZG/ARG-Engine** + **automatisches Einplanen**
  (Constraint-Optimierung).
- **v1 NICHT:** Stempeluhr, Lohnabrechnung.
- **Haftungshinweis:** Arbeitsrechts-Warnungen sind **unverbindliche Hinweise, keine
  Rechtsberatung** (AZG/ARG, Österreich). Muss in der App sichtbar sein.

### 6.5 Modulübergreifend (v1)
- Cockpit-Startseite (4 Kacheln) · Ersteinrichtung (Backup-Ordner wählen, Ladenname für
  Exporte) · Einstellungen (Lizenz, Backup) · gemeinsames Design-System.

## 7. Recht & Datenschutz (Österreich)

- **DSGVO:** Geschäftsdaten der Läden bleiben lokal → kein Verarbeitungsverhältnis dafür.
  **Aber:** Der Anbieter verarbeitet die Daten seiner eigenen B2B-Kunden (Ladenname,
  Kontakt, Zahlung) → **Datenschutzerklärung** nötig; **Stripe = Auftragsverarbeiter**.
- **AGB** mit zwei Klarstellungen: (1) Tageskasse ist keine Registrierkasse i. S. RKSV;
  (2) Schicht-Warnungen sind keine Rechtsberatung.
- **Gewerbe** in AT anmelden; Kleinunternehmer-Regelung prüfen.
- **Code-Signing-Zertifikat** für Windows.

## 8. Geschäftsmodell

- **Preis:** ein einfacher Tarif, ~19–29 €/Monat pro Laden (jährlich günstiger);
  optional später Pro-Aufpreis (volle Schicht-/Auto-Planung).
- **Testphase:** 14–30 Tage kostenlos — entscheidend für den Türverkauf.
- **Vertrieb:** persönlich in der Fußgängerzone, 5-Minuten-Demo am Tablet;
  Empfehlungsprogramm. Realistisch: Verkauf ist Fußarbeit, mehrere Gespräche je Abschluss.

## 9. Laufende Kosten (Anbieter)

Serverless-Endpoint (~0–10 €/Mon) · Static-Hosting Updates (~0 €) · Domain ·
Code-Signing (~100–400 €/Jahr) · Stripe-Gebühren (~1,5 % + 0,25 €/Zahlung).
**Kein DB-Server, keine Cloud für Kundendaten.**

## 10. Risiken

1. **"Für alle ein bisschen"** — Branchen-Breite kann Schärfe kosten; abgefedert durch
   universellen Kern (Tageskasse).
2. **Support-Aufwand** — auch lokale Apps erzeugen Anrufe → einfache In-App-Hilfe einplanen.
3. **Sperre als Frust-Faktor** — muss sanft & fair sein (Vorwarnung, Kulanzfrist).
4. **Scope-Explosion bei Modul 4** — durch Staffelung (v1/v2) bewusst entschärft.

## 11. Bewusst NICHT im Produkt

Kassensystem/POS · Online-Terminbuchung · Kundenkartei/Treuekarten/Newsletter ·
Bewertungs-/Social-Media-Management. (Alle entweder reguliert, internetpflichtig oder
personenbezogen-datenlastig — widersprechen den Leitprinzipien.)

## 12. Offene Punkte für die Implementierungsplanung

- Konkrete Wahl von Frontend-Framework & Komponenten-Bibliothek (Design-Skill).
- Wahl des Serverless-Anbieters für den Lizenz-Endpoint.
- Verschlüsselungsverfahren & Schlüssel-Handling fürs Backup.
- Genaues Protokoll fürs Handy↔PC-WLAN-Pairing.
- Reihenfolge der Modul-Implementierung (Empfehlung: Tageskasse zuerst als Kern).
