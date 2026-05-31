import { useState } from "react";
import { EURO_DENOMINATIONS, totalFromCounts } from "./denominations";
import { formatEuro } from "@/lib/money";

export function CashCounter({ onTotal }: { onTotal: (cents: number) => void }) {
  const [counts, setCounts] = useState<Record<number, number>>({});

  function setCount(denom: number, raw: string) {
    const n = raw === "" ? 0 : Number(raw);
    const next = { ...counts, [denom]: n };
    setCounts(next);
    onTotal(totalFromCounts(next));
  }

  const total = totalFromCounts(counts);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {EURO_DENOMINATIONS.map((d) => (
          <label key={d} className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{formatEuro(d)}</span>
            <input aria-label={`Anzahl ${formatEuro(d)}`} type="number" min={0}
              value={counts[d] ?? ""} onChange={(e) => setCount(d, e.target.value)}
              className="w-20 rounded-lg border border-border px-2 py-1 text-right" />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-medium">Gezählt (Ist)</span>
        <span className="text-lg font-bold">{formatEuro(total)}</span>
      </div>
    </div>
  );
}
