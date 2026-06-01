import { getDb } from "./connection";

export interface NewEmployee {
  name: string;
  wochenstunden: number;
  farbe: string | null;
}
export interface Employee extends NewEmployee {
  id: number;
  aktiv: boolean;
}

interface EmployeeRow {
  id: number;
  name: string;
  wochenstunden: number;
  farbe: string | null;
  aktiv: number;
}

function mapRow(r: EmployeeRow): Employee {
  return { id: r.id, name: r.name, wochenstunden: r.wochenstunden, farbe: r.farbe, aktiv: r.aktiv === 1 };
}

export async function listEmployees(includeInactive = false): Promise<Employee[]> {
  const db = await getDb();
  const where = includeInactive ? "" : "WHERE aktiv = 1 ";
  const rows = await db.select<EmployeeRow[]>(
    `SELECT id, name, wochenstunden, farbe, aktiv FROM employees ${where}ORDER BY name`,
  );
  return rows.map(mapRow);
}

export async function addEmployee(e: NewEmployee): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO employees (name, wochenstunden, farbe, aktiv, erstellt_am) VALUES ($1, $2, $3, 1, $4)",
    [e.name, e.wochenstunden, e.farbe, new Date().toISOString()],
  );
}

export async function updateEmployee(id: number, e: NewEmployee): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE employees SET name = $1, wochenstunden = $2, farbe = $3 WHERE id = $4",
    [e.name, e.wochenstunden, e.farbe, id],
  );
}

export async function setEmployeeActive(id: number, aktiv: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE employees SET aktiv = $1 WHERE id = $2", [aktiv ? 1 : 0, id]);
}

export async function deleteEmployee(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM employees WHERE id = $1", [id]);
}
