import { useState } from "react";
import { addEmployee } from "@/lib/db/employees";

export const FARBEN = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function toHours(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function EmployeeForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [soll, setSoll] = useState("");
  const [farbe, setFarbe] = useState<string>(FARBEN[3]);
  const [fehler, setFehler] = useState<string | null>(null);

  async function add() {
    if (name.trim() === "") { setFehler("Bitte einen Namen eingeben."); return; }
    setFehler(null);
    try {
      await addEmployee({ name: name.trim(), wochenstunden: toHours(soll), farbe });
    } catch {
      setFehler("Hinzufügen fehlgeschlagen."); return;
    }
    onSaved();
    setName(""); setSoll("");
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
          <span className="text-sm font-medium">Wochenstunden (Soll)</span>
          <input aria-label="Wochenstunden" inputMode="decimal" value={soll}
            onChange={(e) => setSoll(e.target.value)} placeholder="z.B. 38,5"
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Farbe</span>
        {FARBEN.map((f) => (
          <button key={f} type="button" aria-label={`Farbe ${f}`} onClick={() => setFarbe(f)}
            className={"h-6 w-6 rounded-full border-2 " + (farbe === f ? "border-foreground" : "border-transparent")}
            style={{ backgroundColor: f }} />
        ))}
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <button type="button" onClick={add}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Hinzufügen
      </button>
    </div>
  );
}
