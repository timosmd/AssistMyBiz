import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShiftCellEditor } from "./ShiftCellEditor";

const presets = [{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }];

function setup(over = {}) {
  const onSave = vi.fn(); const onDelete = vi.fn(); const onClose = vi.fn();
  render(<ShiftCellEditor employeeName="Anna" datumLabel="Mo 01.06." presets={presets}
    initialStart={null} initialEnde={null} onSave={onSave} onDelete={onDelete} onClose={onClose} {...over} />);
  return { onSave, onDelete, onClose };
}

describe("ShiftCellEditor", () => {
  it("übernimmt eine Vorlage und speichert deren Zeiten", async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Früh 08:00–14:00/ }));
    await userEvent.click(screen.getByRole("button", { name: /speichern/i }));
    expect(onSave).toHaveBeenCalledWith("08:00", "14:00");
  });
  it("deaktiviert Speichern bei ungültiger Spanne", async () => {
    setup({ initialStart: "14:00", initialEnde: "08:00" });
    expect(screen.getByRole("button", { name: /speichern/i })).toBeDisabled();
  });
});
