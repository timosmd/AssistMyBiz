import type { Article } from "@/lib/db/articles";

export function isLowStock(a: Article): boolean {
  return a.bestand <= a.mindestbestand;
}

export function filterArticles(list: Article[], query: string): Article[] {
  const q = query.trim().toLowerCase();
  if (q === "") return list;
  return list.filter((a) => `${a.name} ${a.lieferant ?? ""}`.toLowerCase().includes(q));
}
