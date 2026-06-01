function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** Dauer in Dezimalstunden; ende <= start (oder ungültig) → 0. Kein Über-Nacht in v1. */
export function shiftHours(start: string, ende: string): number {
  const s = toMinutes(start);
  const e = toMinutes(ende);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return (e - s) / 60;
}

export function sumHours(shifts: { start: string; ende: string }[]): number {
  return shifts.reduce((acc, s) => acc + shiftHours(s.start, s.ende), 0);
}

export interface Auslastung {
  ist: number;
  soll: number;
  diff: number; // ist - soll: >0 Überstunden, <0 freie Stunden
}

export function auslastung(ist: number, soll: number): Auslastung {
  return { ist, soll, diff: Math.round((ist - soll) * 100) / 100 };
}
