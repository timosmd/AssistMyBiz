import Database from "@tauri-apps/plugin-sql";

export interface NewReceipt {
  datum: string;
  betragCent: number;
  kategorieId: number | null;
  notiz: string | null;
  dateiPfad: string | null;
  dateiTyp: string | null;
}

export interface Receipt extends NewReceipt {
  id: number;
  kategorieName: string | null;
}

let dbPromise: Promise<Database> | null = null;
function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:assistmybiz.db");
  return dbPromise;
}

interface ReceiptRow {
  id: number;
  datum: string;
  betrag_cent: number;
  kategorie_id: number | null;
  kategorie_name: string | null;
  notiz: string | null;
  datei_pfad: string | null;
  datei_typ: string | null;
}

export async function addReceipt(r: NewReceipt): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO receipts (datum, betrag_cent, kategorie_id, notiz, datei_pfad, datei_typ, erstellt_am)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [r.datum, r.betragCent, r.kategorieId, r.notiz, r.dateiPfad, r.dateiTyp, new Date().toISOString()],
  );
}

export async function listReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.select<ReceiptRow[]>(
    `SELECT r.id, r.datum, r.betrag_cent, r.kategorie_id, c.name AS kategorie_name,
            r.notiz, r.datei_pfad, r.datei_typ
       FROM receipts r LEFT JOIN categories c ON c.id = r.kategorie_id
      ORDER BY datum DESC, r.id DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    betragCent: r.betrag_cent,
    kategorieId: r.kategorie_id,
    kategorieName: r.kategorie_name,
    notiz: r.notiz,
    dateiPfad: r.datei_pfad,
    dateiTyp: r.datei_typ,
  }));
}

export async function deleteReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM receipts WHERE id = $1", [id]);
}
