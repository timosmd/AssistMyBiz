import { getDb } from "./connection";
import type { ChecklistItem, ChecklistTemplate, Frequenz } from "./templates";

export interface RunSnapshot {
  name: string;
  frequenz: Frequenz;
  items: ChecklistItem[];
}

export interface ChecklistRun {
  id: number;
  templateId: number | null;
  periode: string;
  snapshot: RunSnapshot;
  itemStates: Record<string, boolean>;
  notiz: string | null;
  abgeschlossenAm: string | null;
}

interface RunRow {
  id: number;
  template_id: number | null;
  periode: string;
  snapshot_json: string;
  item_states_json: string;
  notiz: string | null;
  abgeschlossen_am: string | null;
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function mapRow(r: RunRow): ChecklistRun {
  return {
    id: r.id,
    templateId: r.template_id,
    periode: r.periode,
    snapshot: safeParse<RunSnapshot>(r.snapshot_json, { name: "", frequenz: "taeglich", items: [] }),
    itemStates: safeParse<Record<string, boolean>>(r.item_states_json, {}),
    notiz: r.notiz,
    abgeschlossenAm: r.abgeschlossen_am,
  };
}

export async function getRun(templateId: number, periode: string): Promise<ChecklistRun | null> {
  const db = await getDb();
  const rows = await db.select<RunRow[]>(
    "SELECT id, template_id, periode, snapshot_json, item_states_json, notiz, abgeschlossen_am FROM checklist_runs WHERE template_id = $1 AND periode = $2",
    [templateId, periode],
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function getOrCreateRun(template: ChecklistTemplate, periode: string): Promise<ChecklistRun> {
  const existing = await getRun(template.id, periode);
  if (existing) return existing;
  const db = await getDb();
  const snapshot: RunSnapshot = { name: template.name, frequenz: template.frequenz, items: template.items };
  await db.execute(
    "INSERT OR IGNORE INTO checklist_runs (template_id, periode, snapshot_json, item_states_json, erstellt_am) VALUES ($1, $2, $3, '{}', $4)",
    [template.id, periode, JSON.stringify(snapshot), new Date().toISOString()],
  );
  const created = await getRun(template.id, periode);
  if (!created) throw new Error("Durchführung konnte nicht angelegt werden");
  return created;
}

export async function updateItemStates(runId: number, itemStates: Record<string, boolean>): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE checklist_runs SET item_states_json = $1 WHERE id = $2", [
    JSON.stringify(itemStates), runId,
  ]);
}

export async function completeRun(runId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE checklist_runs SET abgeschlossen_am = $1 WHERE id = $2", [
    new Date().toISOString(), runId,
  ]);
}

export async function listRuns(): Promise<ChecklistRun[]> {
  const db = await getDb();
  const rows = await db.select<RunRow[]>(
    "SELECT id, template_id, periode, snapshot_json, item_states_json, notiz, abgeschlossen_am FROM checklist_runs ORDER BY periode DESC, id DESC",
  );
  return rows.map(mapRow);
}
