import { useEffect, useState } from "react";
import { listTemplates, deleteTemplate, type ChecklistTemplate } from "@/lib/db/templates";
import { TemplateForm } from "./TemplateForm";
import { TemplateList } from "./TemplateList";

export function VorlagenView() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    try {
      setTemplates(await listTemplates());
      setFehler(null);
    } catch {
      setFehler("Vorlagen konnten nicht geladen werden.");
    }
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: number) {
    try {
      await deleteTemplate(id);
      if (editing?.id === id) setEditing(null);
      await reload();
    } catch {
      setFehler("Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      <TemplateForm
        key={editing?.id ?? "new"}
        initial={editing}
        onSaved={() => { setEditing(null); reload(); }}
        onCancel={editing ? () => setEditing(null) : undefined}
      />
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <TemplateList templates={templates} onEdit={(t) => setEditing(t)} onDelete={remove} />
    </div>
  );
}
