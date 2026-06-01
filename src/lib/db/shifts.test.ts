import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listShiftsForWeek, upsertShift, deleteShift } from "./shifts";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

describe("listShiftsForWeek", () => {
  it("baut eine IN-Klausel mit einem Platzhalter je Tag und mappt camelCase", async () => {
    select.mockResolvedValue([
      { id: 9, employee_id: 1, datum: "2026-06-01", start: "08:00", ende: "14:00" },
    ]);
    const list = await listShiftsForWeek(["2026-06-01", "2026-06-02"]);
    expect(list[0]).toEqual({ id: 9, employeeId: 1, datum: "2026-06-01", start: "08:00", ende: "14:00" });
    const [sql, params] = select.mock.calls[0];
    expect(sql).toMatch(/datum IN \(\$1, \$2\)/i);
    expect(params).toEqual(["2026-06-01", "2026-06-02"]);
  });
  it("fragt bei leerer Woche nicht ab", async () => {
    const list = await listShiftsForWeek([]);
    expect(list).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("upsertShift", () => {
  it("löscht zuerst den Tag-Eintrag des Mitarbeiters und legt dann neu an", async () => {
    execute.mockResolvedValue(undefined);
    await upsertShift(1, "2026-06-01", "08:00", "14:00");
    const [delSql, delParams] = execute.mock.calls[0];
    expect(delSql).toMatch(/DELETE FROM shifts WHERE employee_id = \$1 AND datum = \$2/i);
    expect(delParams).toEqual([1, "2026-06-01"]);
    const [insSql, insParams] = execute.mock.calls[1];
    expect(insSql).toMatch(/INSERT INTO shifts/i);
    expect(insParams.slice(0, 4)).toEqual([1, "2026-06-01", "08:00", "14:00"]);
  });
});

describe("deleteShift", () => {
  it("löscht per id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteShift(9);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM shifts WHERE id = \$1/i);
    expect(params).toEqual([9]);
  });
});
