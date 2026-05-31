use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

// ── Server / State / Commands ─────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

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
