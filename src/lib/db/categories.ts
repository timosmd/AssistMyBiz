import Database from "@tauri-apps/plugin-sql";

export interface Category {
  id: number;
  name: string;
  isDefault: boolean;
  sortOrder: number;
}

let dbPromise: Promise<Database> | null = null;
function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:assistmybiz.db");
  return dbPromise;
}

interface CategoryRow {
  id: number;
  name: string;
  is_default: number;
  sort_order: number;
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT id, name, is_default, sort_order FROM categories ORDER BY sort_order, name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.is_default === 1,
    sortOrder: r.sort_order,
  }));
}

export async function addCategory(name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO categories (name, is_default, sort_order) VALUES ($1, 0, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories))",
    [name],
  );
}
