import { useEffect, useState } from "react";
import { listRuns, type ChecklistRun } from "@/lib/db/runs";
import { runProgress } from "./period";

export function HistorieView() {
  const [runs, setRuns] = useState<ChecklistRun[]>([]);

  useEffect(() => {
    listRuns().then(setRuns).catch(() => {});
  }, []);

  if (runs.length === 0) {
    return <p className="text-muted-foreground">Noch keine Durchführungen.</p>;
  }

  return (
    <div className="space-y-2">
      {runs.map((r) => {
        const { done, total } = runProgress(r.itemStates, r.snapshot.items);
        const status = r.abgeschlossenAm
          ? `abgeschlossen ${new Date(r.abgeschlossenAm).toLocaleString("de-AT")}`
          : "offen";
        return (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-col">
              <span className="font-medium">{r.snapshot.name}</span>
              <span className="text-sm text-muted-foreground">{r.periode} · {status}</span>
            </div>
            <span className="text-sm font-medium">{done}/{total}</span>
          </div>
        );
      })}
    </div>
  );
}
