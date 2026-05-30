/** Parst einen Euro-String (Komma oder Punkt) in ganze Cent. Null bei Unsinn. */
export function euroToCents(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed === "" || !/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(parseFloat(trimmed) * 100);
}

/** Cent als editierbarer Euro-String mit Komma, immer zwei Nachkommastellen. */
export function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Cent als angezeigter Betrag „12,34 €" (de-AT). */
export function formatEuro(cents: number): string {
  return (
    new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      cents / 100,
    ) + " €"
  );
}
