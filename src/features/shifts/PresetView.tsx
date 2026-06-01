import { useEffect, useState } from "react";
import { listPresets, addPreset, deletePreset, type ShiftPreset } from "@/lib/db/shiftPresets";

export function PresetView() {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [name, setName] = useState("");
  const [start, setStart] = useState("08:00");
  const [ende, setEnde] = useState("14:00");
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    try { setPresets(await listPresets()); setFehler(null); }
    catch { setFehler("Vorlagen konnten nicht geladen werden."); }
  }
  useEffect(() => { reload(); }, []);

  async function add() {
    if (name.trim() === "") { setFehler("Bitte einen Namen eingeben."); return; }
    try { await addPreset({ name: name.trim(), start, ende }); setName(""); await reload(); }
    catch { setFehler("Hinzufügen fehlgeschlagen."); }
  }
  async function remove(id: number) {
    try { await deletePreset(id); await reload(); }
    catch { setFehler("Löschen fehlgeschlagen."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input aria-label="Vorlagenname" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Mittag" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Von</span>
          <input aria-label="Von" type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Bis</span>
          <input aria-label="Bis" type="time" value={ende} onChange={(e) => setEnde(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
        <button type="button" onClick={add}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Hinzufügen
        </button>
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {presets.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Vorlagen.</p>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-medium">{p.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{p.start}–{p.ende}</span>
                <button type="button" aria-label={`${p.name} löschen`} onClick={() => remove(p.id)}
                  className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
