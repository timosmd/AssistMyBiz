import { describe, it, expect } from "vitest";
import { formatReport, reportFilename, type BugReport } from "./formatReport";

const report: BugReport = {
  zeit: "2026-05-31T22:10:00.000Z",
  prio: "Hoch",
  route: "/till",
  version: "0.3.0",
  os: "Mozilla/5.0 (Windows NT 10.0)",
  beschreibung: "Speichern hängt",
  log: ["ERROR boom", "WARN langsam"],
};

describe("formatReport", () => {
  it("renders frontmatter and both sections", () => {
    const md = formatReport(report);
    expect(md).toMatch(/^---\n/);
    expect(md).toMatch(/prio: Hoch/);
    expect(md).toMatch(/route: \/till/);
    expect(md).toMatch(/## Beschreibung\nSpeichern hängt/);
    expect(md).toMatch(/## Log\nERROR boom\nWARN langsam/);
  });
});

describe("reportFilename", () => {
  it("builds a filesystem-safe name from time and priority", () => {
    expect(reportFilename("2026-05-31T22:10:00.000Z", "Hoch")).toBe(
      "2026-05-31T22-10-00-000Z_Hoch.md",
    );
  });
});
