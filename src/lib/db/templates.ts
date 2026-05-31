import { getDb } from "./connection";

export interface ChecklistItem {
  id: string;
  label: string;
}

export type Frequenz = "taeglich" | "woechentlich";

export interface ChecklistTemplate {
  id: number;
  name: string;
  frequenz: Frequenz;
  items: ChecklistItem[];
}

interface TemplateRow {
  id: number;
  name: string;
  frequenz: string;
  items_json: string;
}

export async function listTemplates(): Promise<ChecklistTemplate[]> {
  const db = await getDb();
  const rows = await db.select<TemplateRow[]>(
    "SELECT id, name, frequenz, items_json FROM checklist_templates ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    frequenz: r.frequenz === "woechentlich" ? "woechentlich" : "taeglich",
    items: safeParseItems(r.items_json),
  }));
}

/** Tolerant gegenüber kaputtem JSON (verliert dann nicht die ganze Liste). */
function safeParseItems(json: string): ChecklistItem[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as ChecklistItem[]) : [];
  } catch {
    return [];
  }
}

export async function addTemplate(name: string, frequenz: Frequenz, items: ChecklistItem[]): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO checklist_templates (name, frequenz, items_json, erstellt_am) VALUES ($1, $2, $3, $4)",
    [name, frequenz, JSON.stringify(items), new Date().toISOString()],
  );
}

export async function updateTemplate(
  id: number, name: string, frequenz: Frequenz, items: ChecklistItem[],
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE checklist_templates SET name = $1, frequenz = $2, items_json = $3 WHERE id = $4",
    [name, frequenz, JSON.stringify(items), id],
  );
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM checklist_templates WHERE id = $1", [id]);
}
