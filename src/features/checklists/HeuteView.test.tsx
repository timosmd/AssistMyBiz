import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChecklistTemplate } from "@/lib/db/templates";
import type { ChecklistRun } from "@/lib/db/runs";

const tmpl: ChecklistTemplate = { id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse hochfahren" }] };
const freshRun: ChecklistRun = {
  id: 9, templateId: 1, periode: "X", snapshot: { name: "Öffnen", frequenz: "taeglich", items: tmpl.items },
  itemStates: {}, notiz: null, abgeschlossenAm: null,
};

const mocks = vi.hoisted(() => ({
  getOrCreateRun: vi.fn(async () => freshRun as ChecklistRun),
  updateItemStates: vi.fn(async () => {}),
  completeRun: vi.fn(async () => {}),
}));

vi.mock("@/lib/db/templates", () => ({ listTemplates: vi.fn(async () => [tmpl]) }));
vi.mock("@/lib/db/runs", () => ({
  getRun: vi.fn(async () => null),
  getOrCreateRun: mocks.getOrCreateRun,
  updateItemStates: mocks.updateItemStates,
  completeRun: mocks.completeRun,
}));

import { HeuteView } from "./HeuteView";

describe("HeuteView", () => {
  it("shows each template and ticks an item (creates the run + writes state)", async () => {
    render(<HeuteView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Kasse hochfahren/i }));
    expect(mocks.getOrCreateRun).toHaveBeenCalledTimes(1);
    expect(mocks.updateItemStates).toHaveBeenCalledWith(9, { o1: true });
  });
});
