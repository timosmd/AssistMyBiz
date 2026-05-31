import type { Article } from "@/lib/db/articles";
import { isLowStock } from "./articleFilter";
import { cn } from "@/lib/utils";

interface ArticleRowProps {
  article: Article;
  onSetBestand: (id: number, bestand: number) => void;
  onDelete: (id: number) => void;
}

export function ArticleRow({ article, onSetBestand, onDelete }: ArticleRowProps) {
  const low = isLowStock(article);
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border bg-card px-4 py-3",
      low ? "border-red-400" : "border-border",
    )}>
      <div className="flex flex-col">
        <span className="font-medium">{article.name}</span>
        {low && <span className="mt-0.5 w-fit rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">nachbestellen</span>}
        <span className="text-sm text-muted-foreground">
          Mindest {article.mindestbestand}{article.einheit ? ` ${article.einheit}` : ""}
          {article.lieferant ? ` · ${article.lieferant}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${article.name} Bestand verringern`}
          onClick={() => onSetBestand(article.id, Math.max(0, article.bestand - 1))}
          className="h-8 w-8 rounded-lg border border-border">−</button>
        <input aria-label={`${article.name} Bestand`} type="number" min={0} value={article.bestand}
          onChange={(e) => onSetBestand(article.id, Math.max(0, Math.floor(Number(e.target.value)) || 0))}
          className="w-16 rounded-lg border border-border px-2 py-1 text-right" />
        <button type="button" aria-label={`${article.name} Bestand erhöhen`}
          onClick={() => onSetBestand(article.id, article.bestand + 1)}
          className="h-8 w-8 rounded-lg border border-border">+</button>
        {article.einheit && <span className="w-8 text-sm text-muted-foreground">{article.einheit}</span>}
        <button type="button" aria-label={`${article.name} löschen`} onClick={() => onDelete(article.id)}
          className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground hover:text-red-600">
          Löschen
        </button>
      </div>
    </div>
  );
}
