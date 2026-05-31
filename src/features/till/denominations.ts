/** Euro-Stückelungen in Cent, absteigend (500 € … 1 ct). */
export const EURO_DENOMINATIONS: number[] = [
  50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
];

/** Summe in Cent aus {Stückelung(Cent): Anzahl}. Ungültige/negative Anzahlen zählen 0. */
export function totalFromCounts(counts: Record<number, number>): number {
  let sum = 0;
  for (const denom of EURO_DENOMINATIONS) {
    const n = counts[denom];
    if (Number.isFinite(n) && n > 0) sum += denom * Math.floor(n);
  }
  return sum;
}

/** Gezählt minus Soll (Kassendifferenz, kann negativ sein). */
export function difference(gezaehltCent: number, sollCent: number): number {
  return gezaehltCent - sollCent;
}
