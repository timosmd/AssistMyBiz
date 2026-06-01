function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Montag der ISO-Woche von `date` (lokale Zeit). */
function monday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIdx = (d.getDay() + 6) % 7; // Mo=0 … So=6
  d.setDate(d.getDate() - dayIdx);
  return d;
}

/** ISO-Wochennummer (1..53). */
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Donnerstag dieser Woche
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThu.getTime()) / 604800000);
}

/** Die 7 ISO-Tage (Mo…So) der Woche von `date`. */
export function weekDays(date: Date): string[] {
  const mo = monday(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mo);
    d.setDate(mo.getDate() + i);
    return isoDate(d);
  });
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n * 7);
  return d;
}

/** z.B. "KW 23 · 01.–07.06.2026". */
export function weekLabel(date: Date): string {
  const mo = monday(date);
  const so = new Date(mo);
  so.setDate(mo.getDate() + 6);
  const kw = isoWeekNumber(date);
  return `KW ${kw} · ${pad2(mo.getDate())}.–${pad2(so.getDate())}.${pad2(so.getMonth() + 1)}.${so.getFullYear()}`;
}
