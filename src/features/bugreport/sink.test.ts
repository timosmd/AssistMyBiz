import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { reportSink } from "./sink";
import type { BugReport } from "./formatReport";

const report: BugReport = {
  zeit: "2026-05-31T22:10:00.000Z",
  prio: "Hoch",
  route: "/till",
  version: "0.3.0",
  os: "agent",
  beschreibung: "Speichern hängt",
  log: ["ERROR boom"],
};

beforeEach(() => invoke.mockReset());

describe("reportSink", () => {
  it("invokes write_bug_report with the filename and formatted content", async () => {
    invoke.mockResolvedValue("C:/repo/bug-reports/x.md");
    await reportSink(report);
    expect(invoke).toHaveBeenCalledTimes(1);
    const [cmd, args] = invoke.mock.calls[0] as [string, { filename: string; content: string }];
    expect(cmd).toBe("write_bug_report");
    expect(args.filename).toBe("2026-05-31T22-10-00-000Z_Hoch.md");
    expect(args.content).toMatch(/## Beschreibung\nSpeichern hängt/);
  });
});
