import { getDb } from "./connection";

export interface DailyClose {
  datum: string;
  gezaehltCent: number | null;
  sollCent: number | null;
  umsatzCent: number | null;
  notiz: string | null;
}

interface DailyCloseRow {
  datum: string;
  gezaehlt_cent: number | null;
  soll_cent: number | null;
  umsatz_cent: number | null;
  notiz: string | null;
}

export async function getDailyClose(datum: string): Promise<DailyClose | null> {
  const db = await getDb();
  const rows = await db.select<DailyCloseRow[]>(
    "SELECT datum, gezaehlt_cent, soll_cent, umsatz_cent, notiz FROM daily_close WHERE datum = $1",
    [datum],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    datum: r.datum,
    gezaehltCent: r.gezaehlt_cent,
    sollCent: r.soll_cent,
    umsatzCent: r.umsatz_cent,
    notiz: r.notiz,
  };
}

export async function listDailyCloses(): Promise<DailyClose[]> {
  const db = await getDb();
  const rows = await db.select<DailyCloseRow[]>(
    "SELECT datum, gezaehlt_cent, soll_cent, umsatz_cent, notiz FROM daily_close ORDER BY datum",
  );
  return rows.map((r) => ({
    datum: r.datum,
    gezaehltCent: r.gezaehlt_cent,
    sollCent: r.soll_cent,
    umsatzCent: r.umsatz_cent,
    notiz: r.notiz,
  }));
}

export async function saveDailyClose(c: DailyClose): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO daily_close (datum, gezaehlt_cent, soll_cent, umsatz_cent, notiz, erstellt_am)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(datum) DO UPDATE SET
       gezaehlt_cent = excluded.gezaehlt_cent,
       soll_cent = excluded.soll_cent,
       umsatz_cent = excluded.umsatz_cent,
       notiz = excluded.notiz`,
    [c.datum, c.gezaehltCent, c.sollCent, c.umsatzCent, c.notiz, new Date().toISOString()],
  );
}
