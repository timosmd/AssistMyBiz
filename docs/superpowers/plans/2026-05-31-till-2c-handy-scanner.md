# Handy-Scanner (2c) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Belege per Handy fotografieren und ins Belege-Modul bringen: während einer Scan-Session betreibt der Rust-Kern einen winzigen lokalen `tiny_http`-Server (LAN), der PC zeigt einen QR-Code, das Handy lädt ein Foto hoch, der Kern legt die Datei ab und feuert ein Tauri-Event, das das Beleg-Formular vorbefüllt.

**Architecture:** Reine, testbare Rust-Helfer (Content-Type→Endung, Token-/Pfad-Parsing) getrennt vom Server-Thread (manuell integrationsgetestet). Das Handy postet die **rohen Datei-Bytes** (kein Multipart) → der Server speichert nach `<AppData>/receipts/scanned/<uuid>.<ext>` und emittiert `receipt-scanned`. Das Frontend (`ScanPanel`) startet/stoppt die Session, zeigt den QR im Webview (`qrcode`) und reicht das gescannte Foto an `ReceiptForm` weiter (bestehender `addReceipt`-Weg).

**Tech Stack:** Tauri 2 (Rust: `tiny_http`, `local-ip-address`, `uuid`; Tauri-Event), React 19 + TS, `qrcode` (JS), Vitest + Testing Library.

---

## File Structure

```
src-tauri/src/scanner.rs            # reine Helfer + Server-Thread + start/stop-Commands + ScanState
src-tauri/src/lib.rs                # mod scanner; commands + .manage(ScanState)
src-tauri/Cargo.toml                # tiny_http, local-ip-address
src/features/scanner/scanUrl.ts     # reine URL-Funktion (+ Test)
src/features/scanner/ScanPanel.tsx  # Start/Stop + QR + Event-Listener (+ Test)
src/features/till/BelegeView.tsx    # ScanPanel + ReceiptForm(prefill) + ReceiptList
src/features/receipts/ReceiptForm.tsx  # + optionales initialDatei
src/routes/till/TillModule.tsx      # Belege-Tab -> <BelegeView/>
```

---

## Task 1: Rust-Helfer (rein) — TDD

**Files:**
- Create: `src-tauri/src/scanner.rs`
- Modify: `src-tauri/src/Cargo.toml` (deps), `src-tauri/src/lib.rs` (mod)

- [ ] **Step 1: Abhängigkeiten ergänzen**

In `src-tauri/Cargo.toml` unter `[dependencies]` ergänzen:
```toml
tiny_http = "0.12"
local-ip-address = "0.6"
```

- [ ] **Step 2: scanner.rs mit reinen Helfern + Tests anlegen**

Create `src-tauri/src/scanner.rs`:
```rust
/// Content-Type -> normalisierte Endung. None = nicht erlaubt.
pub fn ext_from_content_type(ct: &str) -> Option<&'static str> {
    let base = ct.split(';').next().unwrap_or("").trim().to_lowercase();
    match base.as_str() {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "application/pdf" => Some("pdf"),
        _ => None,
    }
}

/// Pfadteil einer Request-URL ("/upload?token=x" -> "/upload").
pub fn path_of(url: &str) -> &str {
    url.split('?').next().unwrap_or(url)
}

/// Token-Query-Parameter aus einer URL lesen.
pub fn parse_token(url: &str) -> Option<String> {
    let q = url.split('?').nth(1)?;
    for pair in q.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some("token") {
            return it.next().map(|s| s.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ext_from_content_type_maps_known_types() {
        assert_eq!(ext_from_content_type("image/jpeg"), Some("jpg"));
        assert_eq!(ext_from_content_type("image/png; charset=binary"), Some("png"));
        assert_eq!(ext_from_content_type("application/pdf"), Some("pdf"));
        assert_eq!(ext_from_content_type("text/html"), None);
    }
    #[test]
    fn path_and_token_parsing() {
        assert_eq!(path_of("/upload?token=abc"), "/upload");
        assert_eq!(path_of("/scan"), "/scan");
        assert_eq!(parse_token("/upload?token=abc"), Some("abc".to_string()));
        assert_eq!(parse_token("/upload?x=1&token=zzz"), Some("zzz".to_string()));
        assert_eq!(parse_token("/upload"), None);
    }
}
```

- [ ] **Step 3: Modul registrieren**

In `src-tauri/src/lib.rs` oben ergänzen:
```rust
mod scanner;
```

- [ ] **Step 4: Rust-Tests + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib scanner 2>&1 | tail -10`
Expected: die zwei scanner-Tests PASS; lädt `tiny_http` + `local-ip-address`; Build ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/scanner.rs src-tauri/src/lib.rs
git commit -m "feat(scanner): tiny_http deps + pure request-parsing helpers"
```

---

## Task 2: Rust Scan-Session-Server + Commands

**Files:**
- Modify: `src-tauri/src/scanner.rs` (Server + Commands + State), `src-tauri/src/lib.rs` (Commands + manage)

- [ ] **Step 1: Server, State und Commands ergänzen**

In `src-tauri/src/scanner.rs` **oben** die Imports ergänzen und **unter** den reinen Helfern (vor `#[cfg(test)]`) den Server-Teil einfügen:
```rust
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const MAX_UPLOAD: u64 = 15 * 1024 * 1024;

const MOBILE_PAGE: &str = r#"<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Beleg scannen</title></head>
<body style="font-family:sans-serif;padding:1.5rem;max-width:480px;margin:auto">
<h1>Beleg fotografieren</h1>
<input id="f" type="file" accept="image/*,application/pdf" capture="environment" style="display:block;margin:1rem 0">
<button id="b" style="padding:.8rem 1.2rem;font-size:1rem">Senden</button><p id="s"></p>
<script>
const p=new URLSearchParams(location.search);
document.getElementById('b').onclick=async()=>{
 const f=document.getElementById('f').files[0];
 if(!f){document.getElementById('s').textContent='Bitte ein Foto wählen.';return;}
 document.getElementById('s').textContent='Senden…';
 try{const r=await fetch('/upload?token='+p.get('token'),{method:'POST',headers:{'Content-Type':f.type},body:f});
 document.getElementById('s').textContent=r.ok?'Gesendet! Zurück zum PC.':'Fehler: '+r.status;}
 catch(e){document.getElementById('s').textContent='Netzwerkfehler.';}
};
</script></body></html>"#;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ScannedPayload {
    relative_path: String,
    file_kind: String,
}

#[derive(serde::Serialize)]
pub struct ScanInfo {
    ip: String,
    port: u16,
    token: String,
}

struct ScanSession {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

#[derive(Default)]
pub struct ScanState(Mutex<Option<ScanSession>>);

fn stop_locked(state: &ScanState) {
    if let Some(mut s) = state.0.lock().unwrap().take() {
        s.stop.store(true, Ordering::Relaxed);
        if let Some(h) = s.handle.take() {
            let _ = h.join();
        }
    }
}

#[tauri::command]
pub fn stop_scan_session(state: tauri::State<ScanState>) {
    stop_locked(&state);
}

#[tauri::command]
pub fn start_scan_session(app: AppHandle, state: tauri::State<ScanState>) -> Result<ScanInfo, String> {
    stop_locked(&state);
    let server = tiny_http::Server::http("0.0.0.0:0").map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().ok_or("kein Port")?.port();
    let ip = local_ip_address::local_ip().map_err(|e| e.to_string())?.to_string();
    let token = uuid::Uuid::new_v4().to_string();
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts");

    let stop = Arc::new(AtomicBool::new(false));
    let stop_t = stop.clone();
    let token_t = token.clone();
    let app_t = app.clone();

    let handle = std::thread::spawn(move || {
        loop {
            if stop_t.load(Ordering::Relaxed) {
                break;
            }
            let mut req = match server.recv_timeout(Duration::from_millis(400)) {
                Ok(Some(r)) => r,
                Ok(None) => continue,
                Err(_) => break,
            };
            let url = req.url().to_string();
            let token_ok = parse_token(&url).as_deref() == Some(token_t.as_str());
            let path = path_of(&url);

            if path == "/scan" && token_ok {
                let header = "Content-Type: text/html; charset=utf-8".parse::<tiny_http::Header>().unwrap();
                let _ = req.respond(tiny_http::Response::from_string(MOBILE_PAGE).with_header(header));
            } else if path == "/upload" && token_ok {
                let ct = req
                    .headers()
                    .iter()
                    .find(|h| h.field.equiv("Content-Type"))
                    .map(|h| h.value.as_str().to_string())
                    .unwrap_or_default();
                match ext_from_content_type(&ct) {
                    Some(ext) => {
                        let mut buf = Vec::new();
                        let read_ok = req.as_reader().take(MAX_UPLOAD).read_to_end(&mut buf).is_ok();
                        if read_ok && !buf.is_empty() {
                            let uuid = uuid::Uuid::new_v4().to_string();
                            let rel = format!("scanned/{uuid}.{ext}");
                            let dest = base.join(&rel);
                            let write_ok = dest
                                .parent()
                                .map(|p| std::fs::create_dir_all(p).is_ok())
                                .unwrap_or(false)
                                && std::fs::write(&dest, &buf).is_ok();
                            if write_ok {
                                let _ = app_t.emit(
                                    "receipt-scanned",
                                    ScannedPayload { relative_path: rel, file_kind: ext.to_string() },
                                );
                                let _ = req.respond(tiny_http::Response::from_string("ok"));
                                stop_t.store(true, Ordering::Relaxed);
                                break;
                            } else {
                                let _ = req.respond(tiny_http::Response::from_string("write").with_status_code(500));
                            }
                        } else {
                            let _ = req.respond(tiny_http::Response::from_string("body").with_status_code(400));
                        }
                    }
                    None => {
                        let _ = req.respond(tiny_http::Response::from_string("type").with_status_code(415));
                    }
                }
            } else {
                let _ = req.respond(tiny_http::Response::from_string("not found").with_status_code(404));
            }
        }
    });

    *state.0.lock().unwrap() = Some(ScanSession { stop, handle: Some(handle) });
    Ok(ScanInfo { ip, port, token })
}
```

- [ ] **Step 2: Commands + State in `lib.rs` registrieren**

In `src-tauri/src/lib.rs` den Builder um den State erweitern (zusätzlich zu den bestehenden `.plugin(...)`-Aufrufen, vor `.run(...)`):
```rust
        .manage(scanner::ScanState::default())
```
und die zwei Commands im `invoke_handler` ergänzen (bestehende behalten):
```rust
            scanner::start_scan_session,
            scanner::stop_scan_session,
```

- [ ] **Step 3: Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo build 2>&1 | tail -5`
Expected: `Finished` ohne Fehler. (Der Netzpfad wird hier nicht automatisiert getestet — siehe Task 6, manueller Test.)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/scanner.rs src-tauri/src/lib.rs
git commit -m "feat(scanner): tiny_http scan session (start/stop, token, upload->event)"
```

---

## Task 3: scanUrl (rein) — TDD

**Files:**
- Create: `src/features/scanner/scanUrl.ts`
- Test: `src/features/scanner/scanUrl.test.ts`

- [ ] **Step 1: Failing Test**

Create `src/features/scanner/scanUrl.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildScanUrl } from "./scanUrl";

describe("buildScanUrl", () => {
  it("builds the /scan URL with ip, port and token", () => {
    expect(buildScanUrl({ ip: "192.168.0.5", port: 51234, token: "abc" }))
      .toBe("http://192.168.0.5:51234/scan?token=abc");
  });
});
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- scanUrl`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/features/scanner/scanUrl.ts`:
```ts
export interface ScanInfo {
  ip: string;
  port: number;
  token: string;
}

export function buildScanUrl(i: ScanInfo): string {
  return `http://${i.ip}:${i.port}/scan?token=${i.token}`;
}
```

- [ ] **Step 4: Test → PASS**

Run: `npm test -- scanUrl`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scanner/scanUrl.ts src/features/scanner/scanUrl.test.ts
git commit -m "feat(scanner): pure scan URL builder"
```

---

## Task 4: ScanPanel — TDD

**Files:**
- Create: `src/features/scanner/ScanPanel.tsx`
- Test: `src/features/scanner/ScanPanel.test.tsx`
- Install: `qrcode` + `@types/qrcode`

- [ ] **Step 1: qrcode installieren**

Run: `npm install qrcode` und `npm install -D @types/qrcode`

- [ ] **Step 2: Failing Test (invoke/event/qrcode gemockt)**

Create `src/features/scanner/ScanPanel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invoke = vi.fn();
const listen = vi.fn(async () => () => {});
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: (...a: unknown[]) => listen(...a) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,xxx") } }));

import { ScanPanel } from "./ScanPanel";

beforeEach(() => { invoke.mockReset(); listen.mockClear(); });

describe("ScanPanel", () => {
  it("starts a session and shows a QR code", async () => {
    invoke.mockResolvedValue({ ip: "192.168.0.5", port: 51234, token: "abc" });
    render(<ScanPanel onScanned={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /mit handy scannen/i }));
    expect(invoke).toHaveBeenCalledWith("start_scan_session");
    expect(await screen.findByRole("img", { name: /qr-code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan beenden/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Test → FAIL**

Run: `npm test -- ScanPanel`
Expected: FAIL.

- [ ] **Step 4: Implement**

Create `src/features/scanner/ScanPanel.tsx`:
```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import QRCode from "qrcode";
import { buildScanUrl, type ScanInfo } from "./scanUrl";

interface ScannedEvent { relativePath: string; fileKind: string; }

export function ScanPanel({ onScanned }: { onScanned: (f: { relative_path: string; file_kind: string }) => void }) {
  const [info, setInfo] = useState<ScanInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let un: UnlistenFn | undefined;
    listen<ScannedEvent>("receipt-scanned", (e) => {
      onScanned({ relative_path: e.payload.relativePath, file_kind: e.payload.fileKind });
      setInfo(null);
      setQr(null);
    }).then((u) => { un = u; });
    return () => { if (un) un(); };
  }, [onScanned]);

  async function start() {
    setFehler(null);
    try {
      const i = await invoke<ScanInfo>("start_scan_session");
      setInfo(i);
      setQr(await QRCode.toDataURL(buildScanUrl(i)));
    } catch {
      setFehler("Scan konnte nicht gestartet werden.");
    }
  }

  async function stop() {
    await invoke("stop_scan_session").catch(() => {});
    setInfo(null);
    setQr(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {!info ? (
        <button type="button" onClick={start} className="rounded-xl border border-border px-4 py-2 text-sm">
          📷 Mit Handy scannen
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">Scanne den QR-Code mit dem Handy (gleiches WLAN):</p>
          {qr && <img src={qr} alt="QR-Code zum Scannen" className="h-44 w-44" />}
          <p className="text-xs text-muted-foreground">
            Beim ersten Mal fragt evtl. die Windows-Firewall — „in privaten Netzen erlauben".
          </p>
          <button type="button" onClick={stop} className="rounded-xl border border-border px-4 py-2 text-sm">
            Scan beenden
          </button>
        </div>
      )}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Test → PASS**

Run: `npm test -- ScanPanel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/scanner/ScanPanel.tsx src/features/scanner/ScanPanel.test.tsx package.json package-lock.json
git commit -m "feat(scanner): ScanPanel (start/stop session, QR, event listener)"
```

---

## Task 5: ReceiptForm-Vorbefüllung + BelegeView + Einhängen — TDD

**Files:**
- Modify: `src/features/receipts/ReceiptForm.tsx`
- Create: `src/features/till/BelegeView.tsx`
- Modify: `src/routes/till/TillModule.tsx`, `src/routes/till/TillModule.test.tsx`
- Test: `src/features/receipts/ReceiptForm.test.tsx` (ein Test ergänzen)

- [ ] **Step 1: ReceiptForm um `initialDatei` erweitern (Test zuerst)**

In `src/features/receipts/ReceiptForm.test.tsx` einen Test ergänzen (innerhalb des bestehenden `describe`):
```tsx
  it("pre-fills the attached file from initialDatei", async () => {
    render(<ReceiptForm onSaved={() => {}} initialDatei={{ relative_path: "scanned/x.jpg", file_kind: "jpg" }} />);
    expect(await screen.findByRole("button", { name: /beleg: jpg/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Test → FAIL**

Run: `npm test -- ReceiptForm`
Expected: FAIL (Prop existiert noch nicht / Button zeigt „Datei wählen").

- [ ] **Step 3: ReceiptForm anpassen**

In `src/features/receipts/ReceiptForm.tsx` die Signatur und einen Effekt ergänzen. Ändere die Funktionssignatur:
```tsx
export function ReceiptForm({ onSaved, initialDatei }: { onSaved: () => void; initialDatei?: ImportedFile | null }) {
```
und direkt nach dem bestehenden `useEffect(() => { listCategories()… }, []);` einen zweiten Effekt einfügen:
```tsx
  useEffect(() => {
    if (initialDatei) setDatei(initialDatei);
  }, [initialDatei]);
```
(Der vorhandene `datei`-State und die Anzeige „Beleg: <TYP> ✓" bleiben unverändert.)

- [ ] **Step 4: Test → PASS**

Run: `npm test -- ReceiptForm`
Expected: PASS.

- [ ] **Step 5: BelegeView anlegen**

Create `src/features/till/BelegeView.tsx`:
```tsx
import { useState } from "react";
import { ScanPanel } from "@/features/scanner/ScanPanel";
import { ReceiptForm } from "@/features/receipts/ReceiptForm";
import { ReceiptList } from "@/features/receipts/ReceiptList";

export function BelegeView() {
  const [reloadKey, setReloadKey] = useState(0);
  const [scanned, setScanned] = useState<{ relative_path: string; file_kind: string } | null>(null);

  return (
    <div className="space-y-6">
      <ScanPanel onScanned={(f) => setScanned(f)} />
      <ReceiptForm
        initialDatei={scanned}
        onSaved={() => { setReloadKey((k) => k + 1); setScanned(null); }}
      />
      <ReceiptList reloadKey={reloadKey} />
    </div>
  );
}
```

- [ ] **Step 6: TillModule-Test um Scanner-Mocks erweitern + Belege-Zweig**

In `src/routes/till/TillModule.test.tsx` oben die zusätzlichen Mocks ergänzen (zu den bestehenden):
```tsx
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:,") } }));
```
(Die `@tauri-apps/api/core`-`invoke`-Mock existiert bereits aus dem Auswertung-Schritt. Falls nicht, ergänze `vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));`.) Der bestehende Belege-Test („renders … Noch keine Belege") bleibt gültig.

- [ ] **Step 7: Belege-Tab auf BelegeView umstellen**

In `src/routes/till/TillModule.tsx` den Import von `ReceiptForm`/`ReceiptList` durch `BelegeView` ersetzen:
```tsx
import { BelegeView } from "@/features/till/BelegeView";
```
und den `reloadKey`-State **aus TillModule entfernen** (lebt jetzt in BelegeView) sowie den Belege-Zweig ersetzen. Aus:
```tsx
      {tab === "belege" && (
        <div className="space-y-6">
          <ReceiptForm onSaved={() => setReloadKey((k) => k + 1)} />
          <ReceiptList reloadKey={reloadKey} />
        </div>
      )}
```
wird:
```tsx
      {tab === "belege" && <BelegeView />}
```
Entferne die jetzt ungenutzten `ReceiptForm`/`ReceiptList`-Imports und die `reloadKey`-Zeile in TillModule (sonst scheitert `noUnusedLocals`).

- [ ] **Step 8: Tests → PASS**

Run: `npm test -- TillModule ReceiptForm`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(scanner): prefill receipt form from scan; BelegeView with ScanPanel"
```

---

## Task 6: Gesamtabnahme + manueller Test + Tag/Push

**Files:** keine

- [ ] **Step 1: Volltest + Build**

Run: `npm test` → alle grün.
Run: `npm run build` → keine TS-Fehler.

- [ ] **Step 2: Rust-Test + Build**

Run: `cd src-tauri && export PATH="$HOME/.cargo/bin:$PATH" && cargo test --lib 2>&1 | tail -8 && cargo build 2>&1 | tail -3`
Expected: scanner-Helfer-Tests grün, Build sauber.

- [ ] **Step 3: Manueller Integrationstest (durch den Menschen)**

Dieser Schritt ist NICHT automatisierbar und wird vom Menschen ausgeführt:
1. `npm run tauri dev`, im Belege-Tab „📷 Mit Handy scannen".
2. Firewall-Abfrage mit „privaten Netzen erlauben" bestätigen.
3. QR mit dem Handy (gleiches WLAN) scannen → Foto wählen → Senden.
4. Am PC erscheint das Beleg-Formular mit angehängter Datei; Betrag/Kategorie ergänzen → Speichern → Beleg in der Liste, Datei unter `<AppData>/receipts/scanned/`.

- [ ] **Step 4: Tag & Push** (Projekt-Workflow)

```bash
git tag -a v0.6.0 -m "v0.6.0 — Handy-Scanner (lokales WLAN, QR, Foto->Beleg)"
git push --follow-tags
```

---

## Definition of Done

- Im Belege-Tab startet „📷 Mit Handy scannen" eine lokale Scan-Session; der PC zeigt einen QR-Code; das Handy lädt im selben WLAN ein Foto hoch; der Beleg landet als vorbefülltes Formular und wird über `addReceipt` gespeichert; der Server stoppt nach dem Upload bzw. „Scan beenden".
- Reine Rust-Helfer (Content-Type/Token/Pfad) und Frontend (`scanUrl`, `ScanPanel`) sind unit-getestet; der Netzpfad ist manuell verifiziert.
- `npm test` grün; `npm run build` ohne TS-Fehler; `cargo test --lib` grün; `cargo build` sauber.
- Stand getaggt **`v0.6.0`** und gepusht.

## Bewusst NICHT in v1

- TLS/HTTPS, Token-Erneuerung, parallele Uploads, mDNS-Namen, Foto-Zuschnitt, Upload-Fortschritt. (Siehe Spec Abschnitt 7.)
