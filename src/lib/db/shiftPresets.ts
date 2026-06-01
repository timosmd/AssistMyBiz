import { getDb } from "./connection";

export interface NewPreset {
  name: string;
  start: string;
  ende: string;
}
export interface ShiftPreset extends NewPreset {
  id: number;
}

export async function listPresets(): Promise<ShiftPreset[]> {
  const db = await getDb();
  return db.select<ShiftPreset[]>("SELECT id, name, start, ende FROM shift_presets ORDER BY start, name");
}

export async function addPreset(p: NewPreset): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO shift_presets (name, start, ende, erstellt_am) VALUES ($1, $2, $3, $4)",
    [p.name, p.start, p.ende, new Date().toISOString()],
  );
}

export async function updatePreset(id: number, p: NewPreset): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE shift_presets SET name = $1, start = $2, ende = $3 WHERE id = $4",
    [p.name, p.start, p.ende, id],
  );
}

export async function deletePreset(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM shift_presets WHERE id = $1", [id]);
}
