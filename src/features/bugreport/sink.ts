import { invoke } from "@tauri-apps/api/core";
import { formatReport, reportFilename, type BugReport } from "./formatReport";

/** v1: schreibt den Report lokal über den Rust-Command (FileSink). */
export async function reportSink(report: BugReport): Promise<void> {
  const content = formatReport(report);
  const filename = reportFilename(report.zeit, report.prio);
  await invoke("write_bug_report", { filename, content });
}
