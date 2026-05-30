import { ClipboardCheck, Wallet, Package, CalendarDays, type LucideIcon } from "lucide-react";

export interface ModuleDef {
  id: "checklists" | "till" | "inventory" | "shifts";
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const MODULES: ModuleDef[] = [
  { id: "checklists", title: "Checklisten", description: "Öffnen, Schließen & wiederkehrende Aufgaben abhaken", path: "/checklists", icon: ClipboardCheck },
  { id: "till", title: "Tageskasse & Belege", description: "Kasse zählen, Belege sammeln, Steuer vorbereiten", path: "/till", icon: Wallet },
  { id: "inventory", title: "Lager", description: "Bestände im Blick, automatische Nachbestell-Liste", path: "/inventory", icon: Package },
  { id: "shifts", title: "Schichten", description: "Wochenplan, Auslastung & Urlaube", path: "/shifts", icon: CalendarDays },
];
