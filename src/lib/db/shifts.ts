import { getDb } from "./connection";

export interface Shift {
  id: number;
  employeeId: number;
  datum: string;
  start: string;
  ende: string;
}

interface ShiftRow {
  id: number;
  employee_id: number;
  datum: string;
  start: string;
  ende: string;
}

export async function listShiftsForWeek(isoDays: string[]): Promise<Shift[]> {
  if (isoDays.length === 0) return [];
  const db = await getDb();
  const placeholders = isoDays.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<ShiftRow[]>(
    `SELECT id, employee_id, datum, start, ende FROM shifts WHERE datum IN (${placeholders})`,
    isoDays,
  );
  return rows.map((r) => ({ id: r.id, employeeId: r.employee_id, datum: r.datum, start: r.start, ende: r.ende }));
}

/** Ersetzt den (höchstens einen) Tag-Eintrag des Mitarbeiters → "ein Eintrag pro Tag". */
export async function upsertShift(employeeId: number, datum: string, start: string, ende: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shifts WHERE employee_id = $1 AND datum = $2", [employeeId, datum]);
  await db.execute(
    "INSERT INTO shifts (employee_id, datum, start, ende, erstellt_am) VALUES ($1, $2, $3, $4, $5)",
    [employeeId, datum, start, ende, new Date().toISOString()],
  );
}

export async function deleteShift(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shifts WHERE id = $1", [id]);
}
