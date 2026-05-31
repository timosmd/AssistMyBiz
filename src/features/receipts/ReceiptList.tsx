import { useEffect, useState } from "react";
import { listReceipts, deleteReceipt, type Receipt } from "@/lib/db/receipts";
import { listCategories, type Category } from "@/lib/db/categories";
import { filterReceipts } from "./filter";
import { ReceiptCard } from "./ReceiptCard";

export function ReceiptList({ reloadKey }: { reloadKey: number }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function reload() {
    setReceipts(await listReceipts());
  }
  useEffect(() => { reload(); }, [reloadKey]);
  useEffect(() => { listCategories().then(setCategories); }, []);

  async function remove(id: number) {
    try {
      await deleteReceipt(id);
      setFehler(null);
      await reload();
    } catch {
      setFehler("Löschen fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  const shown = filterReceipts(receipts, query, categoryId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input aria-label="Suchen" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen (Notiz, Kategorie)…"
          className="flex-1 rounded-xl border border-border px-3 py-2" />
        <select aria-label="Kategorie-Filter" value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-xl border border-border px-3 py-2">
          <option value="">Alle Kategorien</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {shown.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Belege.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => <ReceiptCard key={r.id} receipt={r} onDelete={remove} />)}
        </div>
      )}
    </div>
  );
}
