import { getDb } from "./connection";

export interface NewArticle {
  name: string;
  bestand: number;
  mindestbestand: number;
  einheit: string | null;
  lieferant: string | null;
}

export interface Article extends NewArticle {
  id: number;
}

interface ArticleRow {
  id: number;
  name: string;
  bestand: number;
  mindestbestand: number;
  einheit: string | null;
  lieferant: string | null;
}

export async function listArticles(): Promise<Article[]> {
  const db = await getDb();
  const rows = await db.select<ArticleRow[]>(
    "SELECT id, name, bestand, mindestbestand, einheit, lieferant FROM articles ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bestand: r.bestand,
    mindestbestand: r.mindestbestand,
    einheit: r.einheit,
    lieferant: r.lieferant,
  }));
}

export async function addArticle(a: NewArticle): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO articles (name, bestand, mindestbestand, einheit, lieferant, erstellt_am)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [a.name, a.bestand, a.mindestbestand, a.einheit, a.lieferant, new Date().toISOString()],
  );
}

export async function setBestand(id: number, bestand: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE articles SET bestand = $2 WHERE id = $1", [id, bestand]);
}

export async function deleteArticle(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM articles WHERE id = $1", [id]);
}
