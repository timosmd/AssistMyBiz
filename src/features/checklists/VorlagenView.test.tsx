import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChecklistTemplate } from "@/lib/db/templates";
import { deleteTemplate } from "@/lib/db/templates";

const sample: ChecklistTemplate[] = [
  { id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }] },
  { id: 2, name: "Wöchentlich", frequenz: "woechentlich", items: [] },
];
vi.mock("@/lib/db/templates", () => ({
  listTemplates: vi.fn(async () => sample),
  addTemplate: vi.fn(async () => {}),
  updateTemplate: vi.fn(async () => {}),
  deleteTemplate: vi.fn(async () => {}),
}));

import { VorlagenView } from "./VorlagenView";

describe("VorlagenView", () => {
  it("lists templates and deletes one", async () => {
    render(<VorlagenView />);
    expect(await screen.findByText("Öffnen")).toBeInTheDocument();
    expect(screen.getByText("Wöchentlich")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Öffnen löschen/i }));
    expect(vi.mocked(deleteTemplate)).toHaveBeenCalledWith(1);
  });
});
