import { useState } from "react";
import { addTemplate, updateTemplate, type ChecklistItem, type ChecklistTemplate, type Frequenz } from "@/lib/db/templates";

function newId(): string {
  return crypto.randomUUID();
}

export function TemplateForm({ initial, onSaved, onCancel }: {
  initial?: ChecklistTemplate | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [frequenz, setFrequenz] = useState<Frequenz>(initial?.frequenz ?? "taeglich");
  const [items, setItems] = useState<ChecklistItem[]>(initial?.items ?? []);
  const [neu, setNeu] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  function addItem() {
    const label = neu.trim();
    if (label === "") return;
    setItems([...items, { id: newId(), label }]);
    setNeu("");
  }
  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }
  function renameItem(id: string, label: string) {
    setItems(items.map((i) => (i.id === id ? { ...i, label } : i)));
  }

  async function save() {
    if (name.trim() === "") {
      setFehler("Bitte einen Namen eingeben.");
      return;
    }
    setFehler(null);
    try {
      if (initial) await updateTemplate(initial.id, name.trim(), frequenz, items);
      else await addTemplate(name.trim(), frequenz, items);
    } catch {
      setFehler("Speichern fehlgeschlagen.");
      return;
    }
    onSaved();
    if (!initial) { setName(""); setFrequenz("taeglich"); setItems([]); setNeu(""); }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Frequenz</span>
          <select aria-label="Frequenz" value={frequenz}
            onChange={(e) => setFrequenz(e.target.value as Frequenz)}
            className="rounded-xl border border-border px-3 py-2">
            <option value="taeglich">täglich</option>
            <option value="woechentlich">wöchentlich</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Punkte</span>
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <input aria-label={`Punkt ${i.label}`} value={i.label}
              onChange={(e) => renameItem(i.id, e.target.value)}
              className="flex-1 rounded-lg border border-border px-2 py-1" />
            <button type="button" aria-label={`Punkt ${i.label} entfernen`} onClick={() => removeItem(i.id)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
              Entfernen
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input aria-label="Neuer Punkt" value={neu} onChange={(e) => setNeu(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            placeholder="Neuen Punkt eingeben…" className="flex-1 rounded-lg border border-border px-2 py-1" />
          <button type="button" onClick={addItem}
            className="rounded-lg border border-border px-3 py-1 text-sm">Punkt hinzufügen</button>
        </div>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={save}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {initial ? "Speichern" : "Anlegen"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm">Abbrechen</button>
        )}
      </div>
    </div>
  );
}
