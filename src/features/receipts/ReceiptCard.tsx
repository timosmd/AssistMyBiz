import type { Receipt } from "@/lib/db/receipts";
import { formatEuro } from "@/lib/money";

export function ReceiptCard({ receipt, onDelete }: { receipt: Receipt; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col">
        <span className="font-medium">{receipt.notiz || receipt.kategorieName || "Beleg"}</span>
        <span className="text-sm text-muted-foreground">
          {receipt.datum} · {receipt.kategorieName ?? "—"}
          {receipt.dateiTyp ? ` · ${receipt.dateiTyp.toUpperCase()}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{formatEuro(receipt.betragCent)}</span>
        <button type="button" aria-label={`Beleg ${receipt.id} löschen`}
          onClick={() => onDelete(receipt.id)}
          className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
          Löschen
        </button>
      </div>
    </div>
  );
}
