import { useEffect, useState } from "react";
import { MODULES } from "@/config/modules";
import { ModuleTile } from "@/components/ModuleTile";
import { getSetting, setSetting } from "@/lib/db";

export function Cockpit() {
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const previous = await getSetting("lastOpened");
      if (active) setLastOpened(previous);
      await setSetting("lastOpened", new Date().toISOString());
    })().catch(() => {/* in v1 still: Persistenz ist optional fürs Rendern */});
    return () => { active = false; };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laden-Cockpit</h1>
        <p className="text-muted-foreground">
          {lastOpened ? `Zuletzt geöffnet: ${new Date(lastOpened).toLocaleString("de-AT")}` : "Willkommen!"}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <ModuleTile key={m.id} title={m.title} description={m.description} path={m.path} icon={m.icon} />
        ))}
      </div>
    </main>
  );
}
