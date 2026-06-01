import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addEmployee = vi.fn();
const listEmployees = vi.fn();
const setEmployeeActive = vi.fn();
const deleteEmployee = vi.fn();
vi.mock("@/lib/db/employees", () => ({
  addEmployee: (...a: unknown[]) => addEmployee(...a),
  listEmployees: (...a: unknown[]) => listEmployees(...a),
  setEmployeeActive: (...a: unknown[]) => setEmployeeActive(...a),
  deleteEmployee: (...a: unknown[]) => deleteEmployee(...a),
}));

import { MitarbeiterView } from "./MitarbeiterView";

beforeEach(() => {
  addEmployee.mockReset(); listEmployees.mockReset(); setEmployeeActive.mockReset(); deleteEmployee.mockReset();
  listEmployees.mockResolvedValue([]);
});

describe("MitarbeiterView", () => {
  it("legt einen Mitarbeiter an", async () => {
    addEmployee.mockResolvedValue(undefined);
    render(<MitarbeiterView />);
    await userEvent.type(screen.getByLabelText("Name"), "Anna");
    await userEvent.type(screen.getByLabelText("Wochenstunden"), "38,5");
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addEmployee).toHaveBeenCalledWith({ name: "Anna", wochenstunden: 38.5, farbe: expect.any(String) });
  });

  it("zeigt geladene Mitarbeiter", async () => {
    listEmployees.mockResolvedValue([{ id: 1, name: "Bernd", wochenstunden: 20, farbe: "#3b82f6", aktiv: true }]);
    render(<MitarbeiterView />);
    expect(await screen.findByText("Bernd")).toBeInTheDocument();
  });
});
