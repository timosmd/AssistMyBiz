import { useEffect, useState } from "react";
import { CashCounter } from "./CashCounter";
import { difference } from "./denominations";
import { getDailyClose, saveDailyClose } from "@/lib/db/dailyClose";
import { euroToCents, formatEuro } from "@/lib/money";

export function DailyCloseView() {
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [gezaehltCent, setGezaehltCent] = useState(0);
  const [soll, setSoll] = useState("");
  const [umsatz, setUmsatz] = useState("");
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);

  useEffect(() => {
    let active = true;
    getDailyClose(datum)
      .then((c) => {
        if (!active || !c) return;
        setSoll(c.sollCent !== null ? (c.sollCent / 100).toFixed(2).replace(".", ",") : "");
        setUmsatz(c.umsatzCent !== null ? (c.umsatzCent / 100).toFixed(2).replace(".", ",") : "");
        setNotiz(c.notiz ?? "");
      })
      .catch(() => {/* Laden optional */});
    return () => { active = false; };
  }, [datum]);

  const sollCent = euroToCents(soll) ?? 0;
  const diff = difference(gezaehltCent, sollCent);

  async function save() {
    setFehler(null);
    try {
      await saveDailyClose({
        datum,
        gezaehltCent,
        sollCent: euroToCents(soll),
        umsatzCent: euroToCents(umsatz),
        notiz: notiz.trim() || null,
      });
      setGespeichert(true);
    } catch {
      setFehler("Tagesabschluss konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Datum</span>
          <input aria-label="Datum" type="date" value={datum}
            onChange={(e) => { setDatum(e.target.value); setGespeichert(false); }}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>

      <CashCounter onTotal={setGezaehltCent} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Soll (€)</span>
          <input aria-label="Soll" value={soll} onChange={(e) => setSoll(e.target.value)}
            inputMode="decimal" placeholder="0,00" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tagesumsatz (€)</span>
          <input aria-label="Tagesumsatz" value={umsatz} onChange={(e) => setUmsatz(e.target.value)}
            inputMode="decimal" placeholder="0,00" className="rounded-xl border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">Notiz</span>
          <input aria-label="Notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)}
            className="rounded-xl border border-border px-3 py-2" />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <span className="font-medium">Kassendifferenz (Ist − Soll)</span>
        <span className="text-lg font-bold">{formatEuro(diff)}</span>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      {gespeichert && <p className="text-sm text-emerald-700">Tagesabschluss gespeichert.</p>}

      <button type="button" onClick={save}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Tagesabschluss speichern
      </button>
    </div>
  );
}
