import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { addReceipt } from "@/lib/db/receipts";
import { listCategories, type Category } from "@/lib/db/categories";
import { euroToCents } from "@/lib/money";

interface ImportedFile { relative_path: string; file_kind: string; }

export function ReceiptForm({ onSaved, initialDatei }: { onSaved: () => void; initialDatei?: ImportedFile | null }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [betrag, setBetrag] = useState("");
  const [kategorieId, setKategorieId] = useState<number | null>(null);
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [datei, setDatei] = useState<ImportedFile | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    listCategories().then((cs) => {
      setCategories(cs);
      const sonstiges = cs.find((c) => c.name === "Sonstiges") ?? cs[0];
      if (sonstiges) setKategorieId(sonstiges.id);
    });
  }, []);

  useEffect(() => {
    if (initialDatei) setDatei(initialDatei);
  }, [initialDatei]);

  async function pickFile() {
    const path = await open({
      multiple: false,
      filters: [{ name: "Beleg", extensions: ["jpg", "jpeg", "png", "pdf"] }],
    });
    if (typeof path !== "string") return;
    const year = datum.slice(0, 4);
    try {
      const imported = await invoke<ImportedFile>("import_receipt_file", { srcPath: path, year });
      setDatei(imported);
      setFehler(null);
    } catch {
      setFehler("Datei konnte nicht übernommen werden. Bitte erneut versuchen.");
    }
  }

  async function save() {
    const cents = euroToCents(betrag);
    if (cents === null) {
      setFehler("Bitte einen gültigen Betrag eingeben (z. B. 12,34).");
      return;
    }
    setFehler(null);
    try {
      await addReceipt({
        datum,
        betragCent: cents,
        kategorieId,
        notiz: notiz.trim() || null,
        dateiPfad: datei?.relative_path ?? null,
        dateiTyp: datei?.file_kind ?? null,
      });
    } catch {
      setFehler("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      return;
    }
    onSaved();
    setBetrag(""); setNotiz(""); setDatei(null);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Betrag (€)</span>
          <input aria-label="Betrag" value={betrag} onChange={(e) => setBetrag(e.target.value)}
            inputMode="decimal" placeholder="12,34"
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Datum</span>
          <input aria-label="Datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Kategorie</span>
          <select aria-label="Kategorie" value={kategorieId ?? ""}
            onChange={(e) => setKategorieId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-xl border border-border px-3 py-2">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notiz</span>
          <input aria-label="Notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={pickFile}
          className="rounded-xl border border-border px-4 py-2 text-sm">
          {datei ? `Beleg: ${datei.file_kind.toUpperCase()} ✓` : "Datei wählen"}
        </button>
        <button type="button" onClick={save}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Speichern
        </button>
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
