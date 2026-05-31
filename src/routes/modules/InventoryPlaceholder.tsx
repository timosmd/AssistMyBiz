import { BackLink } from "@/components/BackLink";

export function InventoryPlaceholder() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <BackLink />
      <h1 className="text-2xl font-bold">Lager</h1>
      <p className="text-muted-foreground">Kommt als Nächstes.</p>
    </main>
  );
}
