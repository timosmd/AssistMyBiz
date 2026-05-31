import { Link } from "react-router-dom";

export function BackLink() {
  return (
    <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      ← Zurück zum Cockpit
    </Link>
  );
}
