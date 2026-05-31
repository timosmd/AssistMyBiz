import { useEffect, useState } from "react";
import { listArticles, setBestand, deleteArticle, type Article } from "@/lib/db/articles";
import { filterArticles } from "./articleFilter";
import { ArticleRow } from "./ArticleRow";

export function ArticleList({ reloadKey }: { reloadKey: number }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    setArticles(await listArticles());
  }
  useEffect(() => { reload(); }, [reloadKey]);

  async function changeBestand(id: number, bestand: number) {
    try {
      await setBestand(id, bestand);
      setFehler(null);
      await reload();
    } catch {
      setFehler("Bestand konnte nicht gespeichert werden.");
    }
  }

  async function remove(id: number) {
    try {
      await deleteArticle(id);
      setFehler(null);
      await reload();
    } catch {
      setFehler("Löschen fehlgeschlagen.");
    }
  }

  const shown = filterArticles(articles, query);

  return (
    <div className="space-y-4">
      <input aria-label="Suchen" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Suchen (Name, Lieferant)…"
        className="w-full rounded-xl border border-border px-3 py-2" />
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {shown.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Artikel.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((a) => (
            <ArticleRow key={a.id} article={a} onSetBestand={changeBestand} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
