import { useCallback, useEffect, useState } from "react";
import { listEmployees, type Employee } from "@/lib/db/employees";
import { listPresets, type ShiftPreset } from "@/lib/db/shiftPresets";
import { listShiftsForWeek, upsertShift, deleteShift, type Shift } from "@/lib/db/shifts";
import { weekDays, weekLabel, addWeeks } from "./week";
import { sumHours, auslastung } from "./hours";
import { ShiftCellEditor } from "./ShiftCellEditor";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface CellSel { employeeId: number; datum: string }

export function WochenplanView() {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sel, setSel] = useState<CellSel | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const days = weekDays(anchor);

  const reload = useCallback(async () => {
    try {
      const [emp, pre, sh] = await Promise.all([listEmployees(), listPresets(), listShiftsForWeek(weekDays(anchor))]);
      setEmployees(emp); setPresets(pre); setShifts(sh); setFehler(null);
    } catch {
      setFehler("Plan konnte nicht geladen werden.");
    }
  }, [anchor]);

  useEffect(() => { reload(); }, [reload]);

  function shiftAt(employeeId: number, datum: string): Shift | undefined {
    return shifts.find((s) => s.employeeId === employeeId && s.datum === datum);
  }

  async function save(employeeId: number, datum: string, start: string, ende: string) {
    try { await upsertShift(employeeId, datum, start, ende); setSel(null); await reload(); }
    catch { setFehler("Speichern fehlgeschlagen."); }
  }
  async function remove(employeeId: number, datum: string) {
    const s = shiftAt(employeeId, datum);
    try { if (s) await deleteShift(s.id); setSel(null); await reload(); }
    catch { setFehler("Löschen fehlgeschlagen."); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Woche zurück" onClick={() => setAnchor(addWeeks(anchor, -1))}
          className="rounded-lg border border-border px-2 py-1">‹</button>
        <span className="min-w-[16rem] text-center font-semibold">{weekLabel(anchor)}</span>
        <button type="button" aria-label="Woche vor" onClick={() => setAnchor(addWeeks(anchor, 1))}
          className="rounded-lg border border-border px-2 py-1">›</button>
        <button type="button" onClick={() => setAnchor(new Date())}
          className="rounded-lg border border-border px-3 py-1 text-sm">Heute</button>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {employees.length === 0 && (
        <p className="text-muted-foreground">Lege zuerst im Tab „Mitarbeiter" jemanden an.</p>
      )}

      {employees.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border px-2 py-1 text-left">Mitarbeiter</th>
                {days.map((d, i) => (
                  <th key={d} className="border border-border px-2 py-1 text-center">
                    {WOCHENTAGE[i]}<br /><span className="text-xs text-muted-foreground">{d.slice(8, 10)}.{d.slice(5, 7)}.</span>
                  </th>
                ))}
                <th className="border border-border px-2 py-1 text-right">Woche</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const eigene = shifts.filter((s) => s.employeeId === e.id);
                const ist = sumHours(eigene);
                const a = auslastung(ist, e.wochenstunden);
                return (
                  <tr key={e.id}>
                    <td className="border border-border px-2 py-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: e.farbe ?? "#999" }} />
                        {e.name}
                      </span>
                    </td>
                    {days.map((d) => {
                      const s = shiftAt(e.id, d);
                      const open = sel?.employeeId === e.id && sel?.datum === d;
                      return (
                        <td key={d} className="relative border border-border p-0 text-center">
                          <button type="button"
                            aria-label={`${e.name} ${d} bearbeiten`}
                            onClick={() => setSel({ employeeId: e.id, datum: d })}
                            className="h-full w-full px-2 py-2 hover:bg-accent">
                            {s ? (
                              <span className="rounded px-1 text-xs" style={{ backgroundColor: (e.farbe ?? "#999") + "33" }}>
                                {s.start}–{s.ende}
                              </span>
                            ) : <span className="text-muted-foreground">+</span>}
                          </button>
                          {open && (
                            <ShiftCellEditor
                              employeeName={e.name}
                              datumLabel={`${d.slice(8, 10)}.${d.slice(5, 7)}.`}
                              presets={presets}
                              initialStart={s?.start ?? null}
                              initialEnde={s?.ende ?? null}
                              onSave={(start, ende) => save(e.id, d, start, ende)}
                              onDelete={() => remove(e.id, d)}
                              onClose={() => setSel(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-border px-2 py-1 text-right">
                      <div className="font-medium">{Math.round(ist * 10) / 10} h</div>
                      {e.wochenstunden > 0 && (
                        <div className={"text-xs " + (a.diff > 0 ? "text-amber-600" : "text-emerald-700")}>
                          {a.diff > 0 ? `+${Math.round(a.diff * 10) / 10} h Über` : `${Math.round(-a.diff * 10) / 10} h frei`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
