import type { Article } from "@/lib/db/articles";
import { isLowStock } from "./articleFilter";

export interface ReorderItem {
  article: Article;
  vorschlag: number;
}

export interface SupplierGroup {
  lieferant: string;
  items: ReorderItem[];
}

const OHNE = "Ohne Lieferant";

// Vorschlag = Lücke bis zum Mindestbestand (mind. 0). Bewusst transparent —
// der Kunde sieht Bestand & Mindest daneben und kann selbst abweichen.
export function vorschlagMenge(a: Article): number {
  return Math.max(a.mindestbestand - a.bestand, 0);
}

export function buildReorderGroups(articles: Article[]): SupplierGroup[] {
  const low = articles.filter(isLowStock);
  const byLief = new Map<string, ReorderItem[]>();
  for (const a of low) {
    const key = a.lieferant?.trim() ? a.lieferant.trim() : OHNE;
    if (!byLief.has(key)) byLief.set(key, []);
    byLief.get(key)!.push({ article: a, vorschlag: vorschlagMenge(a) });
  }
  return [...byLief.entries()]
    .map(([lieferant, items]) => ({
      lieferant,
      items: items.sort((x, y) => x.article.name.localeCompare(y.article.name, "de")),
    }))
    .sort((g1, g2) => g1.lieferant.localeCompare(g2.lieferant, "de"));
}

export function buildReorderText(groups: SupplierGroup[], datum: string): string {
  const lines: string[] = [`Nachbestellung — ${datum}`, ""];
  if (groups.length === 0) {
    lines.push("Keine Artikel nachzubestellen.");
    return lines.join("\n");
  }
  for (const g of groups) {
    lines.push(`== ${g.lieferant} ==`);
    for (const { article: a, vorschlag } of g.items) {
      const einheit = a.einheit ? ` ${a.einheit}` : "";
      lines.push(`- ${a.name}: ${vorschlag}${einheit} (Bestand ${a.bestand} / Mindest ${a.mindestbestand})`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
