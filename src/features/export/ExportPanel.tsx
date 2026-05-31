import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listReceipts } from "@/lib/db/receipts";
import { filterReceiptsByMonth, exportFileName, buildIndexCsv, buildSummary } from "./buildExport";

export function ExportPanel() {
  const [monat, setMonat] = useState(() => new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function exportieren() {
    setFehler(null);
    setStatus(null);
    const ziel = await open({ directory: true });
    if (typeof ziel !== "string") return;
    try {
      const all = await listReceipts();
      const monatsBelege = filterReceiptsByMonth(all, monat);
      const files = monatsBelege
        .filter((r) => r.dateiPfad)
        .map((r) => ({ srcRelative: r.dateiPfad as string, destName: exportFileName(r) }));
      const copied = await invoke<number>("export_bookkeeping", {
        targetDir: ziel,
        files,
        indexCsv: buildIndexCsv(monatsBelege),
        summary: buildSummary(monatsBelege, monat),
      });
      setStatus(`Export fertig: ${monatsBelege.length} Belege, ${copied} Dateien kopiert.`);
    } catch {
      setFehler("Export fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h3 className="font-semibold">Export für den Steuerberater</h3>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Monat</span>
          <input aria-label="Monat" type="month" value={monat}
            onChange={(e) => setMonat(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <button type="button" onClick={exportieren}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Exportieren
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Erzeugt im gewählten Ordner: Beleg-Kopien, <code>index.csv</code> und <code>zusammenfassung.txt</code>.
      </p>
      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
