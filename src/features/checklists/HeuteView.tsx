import { useEffect, useState } from "react";
import { listTemplates, type ChecklistTemplate } from "@/lib/db/templates";
import { HeuteRunCard } from "./HeuteRunCard";

export function HeuteView() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
  }, []);

  if (templates.length === 0) {
    return <p className="text-muted-foreground">Noch keine Vorlagen — lege im Tab „Vorlagen" eine an.</p>;
  }

  return (
    <div className="space-y-4">
      {templates.map((t) => <HeuteRunCard key={t.id} template={t} />)}
    </div>
  );
}
