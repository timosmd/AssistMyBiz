import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listEmployees, addEmployee, updateEmployee, setEmployeeActive, deleteEmployee } from "./employees";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

describe("listEmployees", () => {
  it("lädt nur aktive und mappt aktiv->boolean", async () => {
    select.mockResolvedValue([{ id: 1, name: "Anna", wochenstunden: 38.5, farbe: "#f00", aktiv: 1 }]);
    const list = await listEmployees();
    expect(list[0]).toEqual({ id: 1, name: "Anna", wochenstunden: 38.5, farbe: "#f00", aktiv: true });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/WHERE aktiv = 1/i);
  });
  it("lädt alle, wenn includeInactive", async () => {
    select.mockResolvedValue([]);
    await listEmployees(true);
    const [sql] = select.mock.calls[0];
    expect(sql).not.toMatch(/WHERE aktiv/i);
  });
});

describe("addEmployee", () => {
  it("fügt einen Mitarbeiter ein", async () => {
    execute.mockResolvedValue(undefined);
    await addEmployee({ name: "Bernd", wochenstunden: 20, farbe: null });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO employees/i);
    expect(params.slice(0, 3)).toEqual(["Bernd", 20, null]);
  });
});

describe("updateEmployee / setEmployeeActive / deleteEmployee", () => {
  it("update setzt Felder", async () => {
    execute.mockResolvedValue(undefined);
    await updateEmployee(5, { name: "C", wochenstunden: 10, farbe: "#0f0" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE employees SET/i);
    expect(params).toEqual(["C", 10, "#0f0", 5]);
  });
  it("setEmployeeActive setzt aktiv", async () => {
    execute.mockResolvedValue(undefined);
    await setEmployeeActive(5, false);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE employees SET aktiv/i);
    expect(params).toEqual([0, 5]);
  });
  it("delete löscht", async () => {
    execute.mockResolvedValue(undefined);
    await deleteEmployee(5);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM employees WHERE id/i);
    expect(params).toEqual([5]);
  });
});
