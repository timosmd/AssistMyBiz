import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { WochenplanView } from "@/features/shifts/WochenplanView";
import { MitarbeiterView } from "@/features/shifts/MitarbeiterView";
import { PresetView } from "@/features/shifts/PresetView";

type Tab = "plan" | "mitarbeiter" | "vorlagen";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "mitarbeiter", label: "Mitarbeiter" },
  { id: "vorlagen", label: "Vorlagen" },
];

export function ShiftModule() {
  const [tab, setTab] = useState<Tab>("plan");
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <BackLink />
      <h1 className="mb-6 text-2xl font-bold text-foreground">Schichten</h1>
      <div role="tablist" className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={"px-4 py-2 text-sm font-medium " +
              (tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "plan" && <WochenplanView />}
      {tab === "mitarbeiter" && <MitarbeiterView />}
      {tab === "vorlagen" && <PresetView />}
    </main>
  );
}
