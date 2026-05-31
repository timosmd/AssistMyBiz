import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChecklistRun } from "@/lib/db/runs";

const runs: ChecklistRun[] = [
  {
    id: 1, templateId: 1, periode: "2026-05-31",
    snapshot: { name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }, { id: "o2", label: "Licht" }] },
    itemStates: { o1: true }, notiz: null, abgeschlossenAm: "2026-05-31T08:00:00.000Z",
  },
];
vi.mock("@/lib/db/runs", () => ({ listRuns: vi.fn(async () => runs) }));

import { HistorieView } from "./HistorieView";

describe("HistorieView", () => {
  it("lists runs with period, progress and status", async () => {
    render(<HistorieView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    expect(screen.getByText(/2026-05-31/)).toBeInTheDocument();
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();          // Fortschritt
    expect(screen.getByText(/abgeschlossen/i)).toBeInTheDocument();
  });
});
