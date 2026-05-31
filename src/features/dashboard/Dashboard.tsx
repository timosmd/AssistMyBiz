import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { listReceipts, type Receipt } from "@/lib/db/receipts";
import { listDailyCloses, type DailyClose } from "@/lib/db/dailyClose";
import { revenueSeries, expensesByCategory, sumRevenue, sumExpenses } from "./aggregate";
import { formatEuro } from "@/lib/money";

export function Dashboard() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [closes, setCloses] = useState<DailyClose[]>([]);

  useEffect(() => {
    listReceipts().then(setReceipts).catch(() => {/* leer lassen */});
    listDailyCloses().then(setCloses).catch(() => {/* leer lassen */});
  }, []);

  const revenue = revenueSeries(closes).map((p) => ({ ...p, umsatz: p.umsatzCent / 100 }));
  const byCat = expensesByCategory(receipts).map((c) => ({ ...c, betrag: c.summeCent / 100 }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Umsatz (Summe)</p>
          <p className="text-2xl font-bold">{formatEuro(sumRevenue(closes))}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Ausgaben (Summe)</p>
          <p className="text-2xl font-bold">{formatEuro(sumExpenses(receipts))}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Umsatz-Verlauf</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="datum" /><YAxis /><Tooltip />
            <Bar dataKey="umsatz" fill="hsl(168 60% 40%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Ausgaben je Kategorie</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byCat}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="kategorie" /><YAxis /><Tooltip />
            <Bar dataKey="betrag" fill="hsl(220 60% 50%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
