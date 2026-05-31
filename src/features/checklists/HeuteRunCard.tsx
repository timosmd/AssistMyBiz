import { useEffect, useState } from "react";
import type { ChecklistTemplate } from "@/lib/db/templates";
import { getRun, getOrCreateRun, updateItemStates, completeRun, type ChecklistRun } from "@/lib/db/runs";
import { currentPeriod, runProgress } from "./period";

export function HeuteRunCard({ template }: { template: ChecklistTemplate }) {
  const periode = currentPeriod(template.frequenz, new Date());
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getRun(template.id, periode).then((r) => { if (active) setRun(r); }).catch(() => {});
    return () => { active = false; };
  }, [template.id, periode]);

  const states = run?.itemStates ?? {};
  const { done, total } = runProgress(states, template.items);
  const abgeschlossen = run?.abgeschlossenAm != null;

  async function toggle(itemId: string, checked: boolean) {
    try {
      const r = run ?? (await getOrCreateRun(template, periode));
      const next = { ...r.itemStates, [itemId]: checked };
      await updateItemStates(r.id, next);
      setRun({ ...r, itemStates: next });
      setFehler(null);
    } catch {
      setFehler("Konnte nicht gespeichert werden.");
    }
  }

  async function abschliessen() {
    try {
      const r = run ?? (await getOrCreateRun(template, periode));
      await completeRun(r.id);
      setRun({ ...r, abgeschlossenAm: new Date().toISOString() });
    } catch {
      setFehler("Abschließen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{template.name}</span>
        <span className="text-sm text-muted-foreground">
          {template.frequenz === "woechentlich" ? "wöchentlich" : "täglich"} · {done}/{total}
          {abgeschlossen ? " · abgeschlossen" : ""}
        </span>
      </div>
      <div className="space-y-1">
        {template.items.map((i) => (
          <label key={i.id} className="flex items-center gap-2">
            <input type="checkbox" aria-label={i.label} checked={states[i.id] === true}
              onChange={(e) => toggle(i.id, e.target.checked)} />
            <span className={states[i.id] ? "text-muted-foreground line-through" : ""}>{i.label}</span>
          </label>
        ))}
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {!abgeschlossen && (
        <button type="button" onClick={abschliessen}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Abschließen
        </button>
      )}
    </div>
  );
}
