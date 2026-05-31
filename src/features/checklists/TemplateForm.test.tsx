import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addTemplate = vi.fn();
const updateTemplate = vi.fn();
vi.mock("@/lib/db/templates", () => ({
  addTemplate: (...a: unknown[]) => addTemplate(...a),
  updateTemplate: (...a: unknown[]) => updateTemplate(...a),
}));

import { TemplateForm } from "./TemplateForm";

beforeEach(() => { addTemplate.mockReset(); updateTemplate.mockReset(); });

describe("TemplateForm", () => {
  it("blocks saving without a name", async () => {
    render(<TemplateForm onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /anlegen/i }));
    expect(addTemplate).not.toHaveBeenCalled();
    expect(screen.getByText(/namen eingeben/i)).toBeInTheDocument();
  });

  it("creates a template with added items", async () => {
    addTemplate.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<TemplateForm onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Mittags");
    await userEvent.type(screen.getByLabelText(/neuer punkt/i), "Kühlung prüfen");
    await userEvent.click(screen.getByRole("button", { name: /punkt hinzufügen/i }));
    await userEvent.click(screen.getByRole("button", { name: /anlegen/i }));
    expect(addTemplate).toHaveBeenCalledTimes(1);
    const [name, frequenz, items] = addTemplate.mock.calls[0];
    expect(name).toBe("Mittags");
    expect(frequenz).toBe("taeglich");
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Kühlung prüfen");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
