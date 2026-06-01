import { useState } from "react";
import type { ShiftPreset } from "@/lib/db/shiftPresets";
import { shiftHours } from "./hours";

export interface ShiftCellEditorProps {
  employeeName: string;
  datumLabel: string;
  presets: ShiftPreset[];
  initialStart: string | null;
  initialEnde: string | null;
  onSave: (start: string, ende: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ShiftCellEditor({
  employeeName, datumLabel, presets, initialStart, initialEnde, onSave, onDelete, onClose,
}: ShiftCellEditorProps) {
  const [start, setStart] = useState(initialStart ?? "08:00");
  const [ende, setEnde] = useState(initialEnde ?? "14:00");
  const dauer = shiftHours(start, ende);

  return (
    <div role="dialog" aria-label={`${employeeName} · ${datumLabel}`}
      className="absolute left-1/2 z-20 w-64 -translate-x-1/2 space-y-3 rounded-xl border border-border bg-card p-4 text-left shadow-lg">
      <div className="text-sm font-semibold">{employeeName} · {datumLabel}</div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p.id} type="button" onClick={() => { setStart(p.start); setEnde(p.ende); }}
            className="rounded-lg border border-border px-2 py-1 text-xs">
            {p.name} {p.start}–{p.ende}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input aria-label="Von" type="time" value={start} onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-border px-2 py-1" />
        <span>–</span>
        <input aria-label="Bis" type="time" value={ende} onChange={(e) => setEnde(e.target.value)}
          className="rounded-lg border border-border px-2 py-1" />
      </div>
      {dauer === 0
        ? <p className="text-xs text-amber-600">„Bis" muss nach „Von" liegen.</p>
        : <p className="text-xs text-muted-foreground">{dauer} h</p>}
      <div className="flex justify-between">
        <button type="button" onClick={onDelete}
          className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
          Löschen
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-2 py-1 text-sm">Abbrechen</button>
          <button type="button" disabled={dauer === 0} onClick={() => onSave(start, ende)}
            className="rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
