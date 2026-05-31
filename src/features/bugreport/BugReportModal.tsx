import { useState } from "react";
import { useLocation } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { reportSink } from "./sink";
import { getLog } from "./logBuffer";
import type { Priority } from "./formatReport";

const PRIOS: Priority[] = ["Niedrig", "Mittel", "Hoch", "Kritisch"];

export function BugReportModal({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const [beschreibung, setBeschreibung] = useState("");
  const [prio, setPrio] = useState<Priority>("Mittel");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);

  async function send() {
    if (beschreibung.trim() === "") {
      setFehler("Bitte eine Beschreibung eingeben.");
      return;
    }
    setFehler(null);
    const version = await getVersion().catch(() => "?");
    try {
      await reportSink({
        zeit: new Date().toISOString(),
        prio,
        route: location.pathname,
        version,
        os: navigator.userAgent,
        beschreibung: beschreibung.trim(),
        log: getLog(),
      });
      setGesendet(true);
    } catch {
      setFehler("Konnte den Report nicht speichern.");
    }
  }

  return (
    <div role="dialog" aria-label="Bug melden"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Bug melden</h2>
        {gesendet ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Danke! Der Report wurde gespeichert.</p>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Schließen
            </button>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Beschreibung</span>
              <textarea aria-label="Beschreibung" value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)} rows={4}
                className="rounded-xl border border-border px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Priorität</span>
              <select aria-label="Priorität" value={prio}
                onChange={(e) => setPrio(e.target.value as Priority)}
                className="rounded-xl border border-border px-3 py-2">
                {PRIOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-sm">Abbrechen</button>
              <button type="button" onClick={send}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
