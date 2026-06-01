import { useEffect, useState } from "react";
import { listEmployees, setEmployeeActive, deleteEmployee, type Employee } from "@/lib/db/employees";

export function EmployeeList({ reloadKey }: { reloadKey: number }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    try { setEmployees(await listEmployees(true)); setFehler(null); }
    catch { setFehler("Mitarbeiter konnten nicht geladen werden."); }
  }
  useEffect(() => { reload(); }, [reloadKey]);

  async function toggle(e: Employee) {
    try { await setEmployeeActive(e.id, !e.aktiv); await reload(); }
    catch { setFehler("Änderung fehlgeschlagen."); }
  }
  async function remove(id: number) {
    try { await deleteEmployee(id); await reload(); }
    catch { setFehler("Löschen fehlgeschlagen."); }
  }

  if (fehler) return <p className="text-sm text-red-600">{fehler}</p>;
  if (employees.length === 0) return <p className="text-muted-foreground">Noch keine Mitarbeiter.</p>;

  return (
    <div className="space-y-2">
      {employees.map((e) => (
        <div key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: e.farbe ?? "#999" }} />
            <span className={"font-medium " + (e.aktiv ? "" : "text-muted-foreground line-through")}>{e.name}</span>
            <span className="text-sm text-muted-foreground">{e.wochenstunden > 0 ? `${e.wochenstunden} h/Woche` : "ohne Soll"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggle(e)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground">
              {e.aktiv ? "Deaktivieren" : "Aktivieren"}
            </button>
            <button type="button" aria-label={`${e.name} löschen`} onClick={() => remove(e.id)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
              Löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
