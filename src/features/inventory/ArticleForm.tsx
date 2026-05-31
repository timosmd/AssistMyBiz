import { useState } from "react";
import { addArticle } from "@/lib/db/articles";

function toInt(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ArticleForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [bestand, setBestand] = useState("");
  const [mindest, setMindest] = useState("");
  const [einheit, setEinheit] = useState("");
  const [lieferant, setLieferant] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function add() {
    if (name.trim() === "") {
      setFehler("Bitte einen Namen eingeben.");
      return;
    }
    setFehler(null);
    try {
      await addArticle({
        name: name.trim(),
        bestand: toInt(bestand),
        mindestbestand: toInt(mindest),
        einheit: einheit.trim() || null,
        lieferant: lieferant.trim() || null,
      });
    } catch {
      setFehler("Hinzufügen fehlgeschlagen.");
      return;
    }
    onSaved();
    setName(""); setBestand(""); setMindest(""); setEinheit(""); setLieferant("");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">Name</span>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Startbestand</span>
          <input aria-label="Startbestand" type="number" min={0} value={bestand}
            onChange={(e) => setBestand(e.target.value)} className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Mindestbestand</span>
          <input aria-label="Mindestbestand" type="number" min={0} value={mindest}
            onChange={(e) => setMindest(e.target.value)} className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Einheit</span>
          <input aria-label="Einheit" value={einheit} onChange={(e) => setEinheit(e.target.value)}
            placeholder="Stk, kg …" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Lieferant</span>
          <input aria-label="Lieferant" value={lieferant} onChange={(e) => setLieferant(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <button type="button" onClick={add}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Hinzufügen
      </button>
    </div>
  );
}
