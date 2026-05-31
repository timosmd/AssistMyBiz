import type { ChecklistItem, Frequenz } from "@/lib/db/templates";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO-Woche als "YYYY-Www". Rechnet über eine UTC-Hilfsdatum aus den lokalen Y/M/D. */
function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7; // Mo=0 … So=6
  date.setUTCDate(date.getUTCDate() - day + 3); // Donnerstag dieser Woche
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThu.getTime()) / 604800000);
  return `${date.getUTCFullYear()}-W${pad2(week)}`;
}

/** Aktuelle Periode einer Vorlage: ISO-Datum (täglich) bzw. ISO-Woche (wöchentlich). */
export function currentPeriod(frequenz: Frequenz, date: Date): string {
  if (frequenz === "woechentlich") return isoWeekString(date);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Anzahl erledigter Punkte je Snapshot. */
export function runProgress(
  itemStates: Record<string, boolean>,
  items: ChecklistItem[],
): { done: number; total: number } {
  const done = items.filter((i) => itemStates[i.id] === true).length;
  return { done, total: items.length };
}
