import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listEmployees = vi.fn();
const listPresets = vi.fn();
const listShiftsForWeek = vi.fn();
const upsertShift = vi.fn();
const deleteShift = vi.fn();
vi.mock("@/lib/db/employees", () => ({ listEmployees: (...a: unknown[]) => listEmployees(...a) }));
vi.mock("@/lib/db/shiftPresets", () => ({ listPresets: (...a: unknown[]) => listPresets(...a) }));
vi.mock("@/lib/db/shifts", () => ({
  listShiftsForWeek: (...a: unknown[]) => listShiftsForWeek(...a),
  upsertShift: (...a: unknown[]) => upsertShift(...a),
  deleteShift: (...a: unknown[]) => deleteShift(...a),
}));

import { WochenplanView } from "./WochenplanView";

beforeEach(() => {
  listEmployees.mockReset(); listPresets.mockReset(); listShiftsForWeek.mockReset();
  upsertShift.mockReset(); deleteShift.mockReset();
  listPresets.mockResolvedValue([{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }]);
});

describe("WochenplanView", () => {
  it("zeigt einen Hinweis ohne Mitarbeiter", async () => {
    listEmployees.mockResolvedValue([]);
    listShiftsForWeek.mockResolvedValue([]);
    render(<WochenplanView />);
    expect(await screen.findByText(/zuerst im Tab/i)).toBeInTheDocument();
  });

  it("zeigt Mitarbeiter, Schicht-Chip und Wochensumme/Auslastung", async () => {
    listEmployees.mockResolvedValue([{ id: 1, name: "Anna", wochenstunden: 10, farbe: "#3b82f6", aktiv: true }]);
    listShiftsForWeek.mockImplementation(async (days: string[]) => [
      { id: 9, employeeId: 1, datum: days[0], start: "08:00", ende: "14:00" },
    ]);
    render(<WochenplanView />);
    expect(await screen.findByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("08:00–14:00")).toBeInTheDocument();
    expect(screen.getByText("6 h")).toBeInTheDocument();        // Ist
    expect(screen.getByText("4 h frei")).toBeInTheDocument();   // 10 Soll - 6 Ist
  });

  it("speichert eine neue Schicht über den Editor", async () => {
    listEmployees.mockResolvedValue([{ id: 1, name: "Anna", wochenstunden: 0, farbe: null, aktiv: true }]);
    listShiftsForWeek.mockResolvedValue([]);
    upsertShift.mockResolvedValue(undefined);
    render(<WochenplanView />);
    await screen.findByText("Anna");
    const firstCell = screen.getAllByRole("button", { name: /Anna .* bearbeiten/i })[0];
    await userEvent.click(firstCell);
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Früh 08:00–14:00/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /speichern/i }));
    expect(upsertShift).toHaveBeenCalledTimes(1);
    expect(upsertShift.mock.calls[0][2]).toBe("08:00");
    expect(upsertShift.mock.calls[0][3]).toBe("14:00");
  });
});
