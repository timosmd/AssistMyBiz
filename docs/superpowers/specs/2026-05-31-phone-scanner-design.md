# Handy-Scanner (Plan 2c) — Umsetzungs-Design

**Datum:** 2026-05-31
**Status:** Freigegeben (Kurz-Brainstorming)
**Teil von:** Laden-Cockpit, Modul „Tageskasse & Belege" (Abschnitt 8 des Modul-Specs)

---

## 1. Ziel

Belege per Handy fotografieren und ins Belege-Modul bringen — **rein im lokalen WLAN**,
ohne Internet, ohne Kundendaten-Abfluss. Der PC zeigt einen QR-Code; das Handy öffnet
eine kleine Seite, schießt/wählt ein Foto, das landet als **vorbefülltes Beleg-Formular**
am PC (Betrag/Kategorie ergänzt der Nutzer).

## 2. Technik-Entscheidungen

- **HTTP-Server:** `tiny_http` (minimal, blockierend, eigener Thread — kein async/tokio).
- **LAN-IP:** Crate `local-ip-address`.
- **QR-Code:** im Webview per JS-Lib `qrcode` (kein QR in Rust).
- **Benachrichtigung PC:** **Tauri-Event** (`receipt-scanned`), kein DB-Polling.
- **DB bleibt im JS-Layer:** Rust schreibt nur die Datei, das Frontend legt den Beleg
  über den bestehenden `addReceipt`-Weg an.

## 3. Ablauf (Scan-Session)

1. Nutzer klickt im **Belege-Tab** auf „Mit Handy scannen" → `start_scan_session()`.
2. **Rust** startet einen `tiny_http`-Server auf einem freien Port, gebunden an die
   LAN-IP, erzeugt ein **Einmal-Token**, gibt `{ ip, port, token }` zurück.
3. Das Frontend zeigt einen **QR-Code** für `http://<ip>:<port>/scan?token=<token>`.
4. Das **Handy** (gleiches WLAN) scannt → Server liefert auf `GET /scan?token=…` eine
   **schlanke Inline-HTML-Seite** (Datei-/Kamera-Input + Senden).
5. Handy sendet `POST /upload?token=…` (Foto). Server prüft das Token, schreibt die Bytes
   nach `<AppData>/receipts/<jahr>/<uuid>.<ext>` (gleiche Ablage wie `import_receipt_file`),
   und **feuert das Event** `receipt-scanned` mit `{ relativePath, fileKind }`.
6. Das Frontend hört per `listen("receipt-scanned", …)` und **füllt das Beleg-Formular
   vor** (Datei angehängt). Nutzer ergänzt Betrag/Kategorie → `addReceipt`.
7. Server stoppt **automatisch nach erfolgreichem Upload** (Token verbraucht) bzw. bei
   „Scan beenden"/Schließen → `stop_scan_session()`.

## 4. Sicherheit / Guardrails (v1)

- **Nur im LAN**, HTTP (kein TLS) — bewusst, weil rein lokal + kurzlebig.
- Server läuft **nur während des Scannens**; nur die zwei Routen; Einmal-Token,
  falsches/fehlendes Token → 404.
- Erlaubte Dateitypen jpg/png/pdf (wie bei `import_receipt_file`), Größenlimit (z. B. 15 MB).
- **Windows-Firewall** fragt evtl. beim ersten Mal („privates Netz erlauben") →
  klarer In-App-Hinweis.

## 5. Dateistruktur

```
src-tauri/src/scanner.rs           # tiny_http-Server, Routen, Token, Datei-aus-Bytes, Event
src-tauri/src/lib.rs               # Modul + start/stop-Commands + managed State registrieren
src/features/scanner/ScanPanel.tsx # „Mit Handy scannen", QR anzeigen, Event hören
src/features/scanner/ScanPanel.test.tsx
src/features/scanner/scanUrl.ts    # reine Funktion: {ip,port,token} -> URL (+ Test)
src/routes/till/  bzw. Belege-View # ScanPanel + vorbefülltes Formular verbinden
```

Rust hält eine **Scan-Session als managed State** (Token + Stop-Signal/Thread-Handle).

## 6. Tests

- **Rust (rein/Unit):** Token-Vergleich, erlaubter Dateityp aus Content-Type/Endung,
  Ziel-Pfad-Bau (wiederverwendet vorhandene Helfer), URL-/Token-Erzeugung.
- **Frontend:** `scanUrl` (rein); ScanPanel rendert QR bei Session-Start (Command +
  `qrcode` gemockt) und reagiert auf das `receipt-scanned`-Event (Event gemockt).
- **Manuell (Integration):** echter Handy↔PC-Netzpfad (ein Gerät, gleiches WLAN) —
  wie im Modul-Spec vermerkt, nicht automatisierbar.

## 7. Bewusst NICHT in v1

- TLS/HTTPS, Authentifizierung über Token hinaus, mehrere parallele Uploads,
  Geräte-Kopplung über mDNS-Namen (IP+QR genügt), Foto-Bearbeitung/Zuschnitt,
  Fortschrittsbalken beim Upload.

## 8. Offene Punkte für die Planung

- Genaues Multipart-/Body-Parsing in `tiny_http` (kleiner manueller Parser vs. Hilfs-Crate).
- Port-Strategie (fest vs. ephemer) und Verhalten, wenn die Firewall blockt (Timeout-Hinweis).
- Event-Nutzlast-Form und wie das Belege-View die vorbefüllte Datei an `ReceiptForm` übergibt.
