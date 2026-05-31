import type { ChecklistTemplate } from "@/lib/db/templates";

export function TemplateList({ templates, onEdit, onDelete }: {
  templates: ChecklistTemplate[];
  onEdit: (t: ChecklistTemplate) => void;
  onDelete: (id: number) => void;
}) {
  if (templates.length === 0) {
    return <p className="text-muted-foreground">Noch keine Vorlagen.</p>;
  }
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium">{t.name}</span>
            <span className="text-sm text-muted-foreground">
              {t.frequenz === "woechentlich" ? "wöchentlich" : "täglich"} · {t.items.length} Punkte
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label={`${t.name} bearbeiten`} onClick={() => onEdit(t)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-primary">Bearbeiten</button>
            <button type="button" aria-label={`${t.name} löschen`} onClick={() => onDelete(t.id)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">Löschen</button>
          </div>
        </div>
      ))}
    </div>
  );
}
