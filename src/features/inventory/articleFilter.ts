import type { Article } from "@/lib/db/articles";

export function isLowStock(a: Article): boolean {
  // Nur „nachbestellen", wenn ein Mindestbestand gesetzt ist (sonst würde ein
  // frischer Artikel mit 0/0 sofort als zu niedrig markiert).
  return a.mindestbestand > 0 && a.bestand <= a.mindestbestand;
}

export function filterArticles(list: Article[], query: string): Article[] {
  const q = query.trim().toLowerCase();
  if (q === "") return list;
  return list.filter((a) => `${a.name} ${a.lieferant ?? ""}`.toLowerCase().includes(q));
}
