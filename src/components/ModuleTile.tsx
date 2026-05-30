import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleTileProps {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export function ModuleTile({ title, description, path, icon: Icon }: ModuleTileProps) {
  return (
    <Link
      to={path}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6",
        "shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary"
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold text-card-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </Link>
  );
}
