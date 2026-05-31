import { useEffect, useState } from "react";
import { listDailyCloses, deleteDailyClose, type DailyClose } from "@/lib/db/dailyClose";
import { difference } from "./denominations";
import { formatEuro } from "@/lib/money";

export function DailyCloseHistory({ reloadKey, onEdit }: { reloadKey: number; onEdit: (datum: string) => void }) {
  const [rows, setRows] = useState<DailyClose[]>([]);

  async function reload() {
    const all = await listDailyCloses();
    setRows([...all].sort((a, b) => b.datum.localeCompare(a.datum)));
  }
  useEffect(() => { reload(); }, [reloadKey]);

  async function remove(datum: string) {
    await deleteDailyClose(datum);
    await reload();
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Tagesabschlüsse.</p>;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Bisherige Tagesabschlüsse</h3>
      {rows.map((r) => (
        <div key={r.datum} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium">{r.datum}</span>
            <span className="text-sm text-muted-foreground">
              Ist {formatEuro(r.gezaehltCent ?? 0)} · Soll {formatEuro(r.sollCent ?? 0)} · Umsatz {formatEuro(r.umsatzCent ?? 0)} · Diff {formatEuro(difference(r.gezaehltCent ?? 0, r.sollCent ?? 0))}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label={`${r.datum} bearbeiten`} onClick={() => onEdit(r.datum)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-primary">Bearbeiten</button>
            <button type="button" aria-label={`${r.datum} löschen`} onClick={() => remove(r.datum)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">Löschen</button>
          </div>
        </div>
      ))}
    </div>
  );
}
