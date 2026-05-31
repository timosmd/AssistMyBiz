import { useState } from "react";
import { ReceiptForm } from "@/features/receipts/ReceiptForm";
import { ReceiptList } from "@/features/receipts/ReceiptList";
import { DailyCloseView } from "@/features/till/DailyCloseView";

type Tab = "belege" | "tageskasse" | "auswertung";

const TABS: { id: Tab; label: string }[] = [
  { id: "belege", label: "Belege" },
  { id: "tageskasse", label: "Tageskasse" },
  { id: "auswertung", label: "Auswertung" },
];

export function TillModule() {
  const [tab, setTab] = useState<Tab>("belege");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Tageskasse &amp; Belege</h1>
      <div role="tablist" className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={
              "px-4 py-2 text-sm font-medium " +
              (tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground")
            }>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "belege" && (
        <div className="space-y-6">
          <ReceiptForm onSaved={() => setReloadKey((k) => k + 1)} />
          <ReceiptList reloadKey={reloadKey} />
        </div>
      )}
      {tab === "tageskasse" && <DailyCloseView />}
      {tab === "auswertung" && <p className="text-muted-foreground">Auswertung — bald verfügbar.</p>}
    </main>
  );
}
