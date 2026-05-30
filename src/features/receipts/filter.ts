import type { Receipt } from "@/lib/db/receipts";

export function filterReceipts(
  receipts: Receipt[],
  query: string,
  categoryId: number | null,
): Receipt[] {
  const q = query.trim().toLowerCase();
  return receipts.filter((r) => {
    if (categoryId !== null && r.kategorieId !== categoryId) return false;
    if (q === "") return true;
    const haystack = `${r.notiz ?? ""} ${r.kategorieName ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}
