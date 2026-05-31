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
