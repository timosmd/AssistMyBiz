import type { Receipt } from "@/lib/db/receipts";
import type { DailyClose } from "@/lib/db/dailyClose";

export interface RevenuePoint { datum: string; umsatzCent: number; }
export interface CategorySum { kategorie: string; summeCent: number; }

export function revenueSeries(closes: DailyClose[]): RevenuePoint[] {
  return closes
    .map((c) => ({ datum: c.datum, umsatzCent: c.umsatzCent ?? 0 }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export function expensesByCategory(receipts: Receipt[]): CategorySum[] {
  const map = new Map<string, number>();
  for (const r of receipts) {
    const key = r.kategorieName ?? "Ohne Kategorie";
    map.set(key, (map.get(key) ?? 0) + r.betragCent);
  }
  return [...map.entries()]
    .map(([kategorie, summeCent]) => ({ kategorie, summeCent }))
    .sort((a, b) => b.summeCent - a.summeCent);
}

export function sumRevenue(closes: DailyClose[]): number {
  return closes.reduce((acc, c) => acc + (c.umsatzCent ?? 0), 0);
}

export function sumExpenses(receipts: Receipt[]): number {
  return receipts.reduce((acc, r) => acc + r.betragCent, 0);
}
