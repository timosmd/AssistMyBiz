import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/db/templates", () => ({
  listTemplates: vi.fn(async () => []),
  addTemplate: vi.fn(async () => {}),
  updateTemplate: vi.fn(async () => {}),
  deleteTemplate: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/runs", () => ({
  getRun: vi.fn(async () => null),
  getOrCreateRun: vi.fn(),
  updateItemStates: vi.fn(),
  completeRun: vi.fn(),
  listRuns: vi.fn(async () => []),
}));

import { ChecklistModule } from "./ChecklistModule";

describe("ChecklistModule", () => {
  it("shows the Vorlagen tab with the editor + a back link", async () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /vorlagen/i }));
    expect(screen.getByRole("button", { name: /anlegen/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine vorlagen/i)).toBeInTheDocument();
  });

  it("shows the Heute tab content by default", async () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    expect(await screen.findByText(/lege im tab/i)).toBeInTheDocument();
  });

  it("switches to the Historie tab", async () => {
    render(<MemoryRouter><ChecklistModule /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /historie/i }));
    expect(await screen.findByText(/noch keine durchführungen/i)).toBeInTheDocument();
  });
});
