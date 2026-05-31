import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { VorlagenView } from "@/features/checklists/VorlagenView";

type Tab = "heute" | "vorlagen" | "historie";

const TABS: { id: Tab; label: string }[] = [
  { id: "heute", label: "Heute" },
  { id: "vorlagen", label: "Vorlagen" },
  { id: "historie", label: "Historie" },
];

export function ChecklistModule() {
  const [tab, setTab] = useState<Tab>("heute");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <BackLink />
      <h1 className="mb-6 text-2xl font-bold text-foreground">Checklisten</h1>
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

      {tab === "heute" && <p className="text-muted-foreground">Heute — bald verfügbar.</p>}
      {tab === "vorlagen" && <VorlagenView />}
      {tab === "historie" && <p className="text-muted-foreground">Historie — bald verfügbar.</p>}
    </main>
  );
}
