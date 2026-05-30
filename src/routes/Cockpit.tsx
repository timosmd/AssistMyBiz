import { MODULES } from "@/config/modules";
import { ModuleTile } from "@/components/ModuleTile";

export function Cockpit() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laden-Cockpit</h1>
        <p className="text-muted-foreground">Dein Tag auf einen Blick.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <ModuleTile key={m.id} title={m.title} description={m.description} path={m.path} icon={m.icon} />
        ))}
      </div>
    </main>
  );
}
