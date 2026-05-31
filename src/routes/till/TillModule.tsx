import { useState } from "react";
import { BelegeView } from "@/features/till/BelegeView";
import { DailyCloseView } from "@/features/till/DailyCloseView";
import { AuswertungView } from "@/features/till/AuswertungView";
import { BackLink } from "@/components/BackLink";

type Tab = "belege" | "tageskasse" | "auswertung";

const TABS: { id: Tab; label: string }[] = [
  { id: "belege", label: "Belege" },
  { id: "tageskasse", label: "Tageskasse" },
  { id: "auswertung", label: "Auswertung" },
];

export function TillModule() {
  const [tab, setTab] = useState<Tab>("belege");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <BackLink />
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

      {tab === "belege" && <BelegeView />}
      {tab === "tageskasse" && <DailyCloseView />}
      {tab === "auswertung" && <AuswertungView />}
    </main>
  );
}
