import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listPresets, addPreset, updatePreset, deletePreset } from "./shiftPresets";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

describe("shiftPresets", () => {
  it("listPresets lädt sortiert", async () => {
    select.mockResolvedValue([{ id: 1, name: "Früh", start: "08:00", ende: "14:00" }]);
    const list = await listPresets();
    expect(list[0]).toEqual({ id: 1, name: "Früh", start: "08:00", ende: "14:00" });
  });
  it("addPreset fügt ein", async () => {
    execute.mockResolvedValue(undefined);
    await addPreset({ name: "Mittag", start: "11:00", ende: "15:00" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO shift_presets/i);
    expect(params.slice(0, 3)).toEqual(["Mittag", "11:00", "15:00"]);
  });
  it("updatePreset setzt Felder", async () => {
    execute.mockResolvedValue(undefined);
    await updatePreset(2, { name: "X", start: "09:00", ende: "10:00" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE shift_presets SET/i);
    expect(params).toEqual(["X", "09:00", "10:00", 2]);
  });
  it("deletePreset löscht", async () => {
    execute.mockResolvedValue(undefined);
    await deletePreset(2);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM shift_presets WHERE id/i);
    expect(params).toEqual([2]);
  });
});
