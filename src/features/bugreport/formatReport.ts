export type Priority = "Niedrig" | "Mittel" | "Hoch" | "Kritisch";

export interface BugReport {
  zeit: string;
  prio: Priority;
  route: string;
  version: string;
  os: string;
  beschreibung: string;
  log: string[];
}

export function formatReport(r: BugReport): string {
  return (
    `---\n` +
    `zeit: ${r.zeit}\n` +
    `prio: ${r.prio}\n` +
    `route: ${r.route}\n` +
    `version: ${r.version}\n` +
    `os: ${r.os}\n` +
    `---\n\n` +
    `## Beschreibung\n${r.beschreibung}\n\n` +
    `## Log\n${r.log.join("\n")}\n`
  );
}

export function reportFilename(zeitIso: string, prio: Priority): string {
  return `${zeitIso.replace(/[:.]/g, "-")}_${prio}.md`;
}
