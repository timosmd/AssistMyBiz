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
const getOrCreateRun = vi.fn(async () => freshRun);
const updateItemStates = vi.fn(async () => {});
const completeRun = vi.fn(async () => {});
vi.mock("@/lib/db/templates", () => ({ listTemplates: vi.fn(async () => [tmpl]) }));
vi.mock("@/lib/db/runs", () => ({
  getRun: vi.fn(async () => null),
  getOrCreateRun: (...a: unknown[]) => getOrCreateRun(...a),
  updateItemStates: (...a: unknown[]) => updateItemStates(...a),
  completeRun: (...a: unknown[]) => completeRun(...a),
}));

import { HeuteView } from "./HeuteView";

describe("HeuteView", () => {
  it("shows each template and ticks an item (creates the run + writes state)", async () => {
    render(<HeuteView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Kasse hochfahren/i }));
    expect(getOrCreateRun).toHaveBeenCalledTimes(1);
    expect(updateItemStates).toHaveBeenCalledWith(9, { o1: true });
  });
});
