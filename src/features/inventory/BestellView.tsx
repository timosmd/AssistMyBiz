import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listArticles } from "@/lib/db/articles";
import { buildReorderGroups, buildReorderText, type SupplierGroup } from "./reorderList";

export function BestellView() {
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    listArticles()
      .then((arts) => { setGroups(buildReorderGroups(arts)); setFehler(null); })
      .catch(() => setFehler("Artikel konnten nicht geladen werden."));
  }, []);

  async function exportieren() {
    setStatus(null);
    setFehler(null);
    const ziel = await open({ directory: true });
    if (typeof ziel !== "string") return;
    try {
      const datum = new Date().toISOString().slice(0, 10);
      await invoke("export_reorder", { targetDir: ziel, content: buildReorderText(groups, datum) });
      setStatus("Liste gespeichert: nachbestellung.txt");
    } catch {
      setFehler("Export fehlgeschlagen.");
    }
  }

  const anzahl = groups.reduce((n, g) => n + g.items.length, 0);

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        <p className="text-muted-foreground">Alles ausreichend bestückt 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{anzahl} Artikel nachzubestellen</p>
        <button type="button" onClick={exportieren}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Als Datei exportieren
        </button>
      </div>
      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      {groups.map((g) => (
        <div key={g.lieferant} className="space-y-2 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">{g.lieferant}</h3>
          <div className="space-y-1">
            {g.items.map(({ article: a, vorschlag }) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">
                  Vorschlag {vorschlag}{a.einheit ? ` ${a.einheit}` : ""} · Bestand {a.bestand} / Mindest {a.mindestbestand}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
