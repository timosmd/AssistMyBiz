import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/db/employees", () => ({ listEmployees: vi.fn(async () => []) }));
vi.mock("@/lib/db/shiftPresets", () => ({ listPresets: vi.fn(async () => []) }));
vi.mock("@/lib/db/shifts", () => ({
  listShiftsForWeek: vi.fn(async () => []),
  upsertShift: vi.fn(), deleteShift: vi.fn(),
}));

import { ShiftModule } from "./ShiftModule";

describe("ShiftModule", () => {
  it("zeigt den Plan-Tab mit Wochen-Navigation und einen Back-Link", async () => {
    render(<MemoryRouter><ShiftModule /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /plan/i })).toBeInTheDocument();
    expect(await screen.findByText(/zuerst im Tab/i)).toBeInTheDocument();
  });
  it("wechselt zum Mitarbeiter-Tab", async () => {
    render(<MemoryRouter><ShiftModule /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /mitarbeiter/i }));
    expect(await screen.findByText(/noch keine mitarbeiter/i)).toBeInTheDocument();
  });
});
