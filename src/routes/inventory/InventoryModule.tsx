import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { ArticleForm } from "@/features/inventory/ArticleForm";
import { ArticleList } from "@/features/inventory/ArticleList";
import { BestellView } from "@/features/inventory/BestellView";

type Tab = "artikel" | "bestellung";

const TABS: { id: Tab; label: string }[] = [
  { id: "artikel", label: "Artikel" },
  { id: "bestellung", label: "Bestellung" },
];

export function InventoryModule() {
  const [tab, setTab] = useState<Tab>("artikel");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <BackLink />
      <h1 className="mb-6 text-2xl font-bold text-foreground">Lager</h1>
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

      {tab === "artikel" && (
        <div className="space-y-6">
          <ArticleForm onSaved={() => setReloadKey((k) => k + 1)} />
          <ArticleList reloadKey={reloadKey} />
        </div>
      )}
      {tab === "bestellung" && <BestellView />}
    </main>
  );
}
