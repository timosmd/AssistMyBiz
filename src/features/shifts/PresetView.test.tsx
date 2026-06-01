import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listPresets = vi.fn();
const addPreset = vi.fn();
const deletePreset = vi.fn();
vi.mock("@/lib/db/shiftPresets", () => ({
  listPresets: (...a: unknown[]) => listPresets(...a),
  addPreset: (...a: unknown[]) => addPreset(...a),
  deletePreset: (...a: unknown[]) => deletePreset(...a),
}));

import { PresetView } from "./PresetView";

beforeEach(() => {
  listPresets.mockReset(); addPreset.mockReset(); deletePreset.mockReset();
  listPresets.mockResolvedValue([{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }]);
});

describe("PresetView", () => {
  it("zeigt vorhandene Vorlagen", async () => {
    render(<PresetView />);
    expect(await screen.findByText("Früh")).toBeInTheDocument();
    expect(screen.getByText("08:00–14:00")).toBeInTheDocument();
  });
  it("legt eine Vorlage an", async () => {
    addPreset.mockResolvedValue(undefined);
    render(<PresetView />);
    await screen.findByText("Früh");
    await userEvent.type(screen.getByLabelText("Vorlagenname"), "Mittag");
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addPreset).toHaveBeenCalledWith({ name: "Mittag", start: "08:00", ende: "14:00" });
  });
});
