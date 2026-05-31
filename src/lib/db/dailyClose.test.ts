import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { getDailyClose, saveDailyClose } from "./dailyClose";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("getDailyClose", () => {
  it("returns null when there is no row for the date", async () => {
    select.mockResolvedValue([]);
    expect(await getDailyClose("2026-05-31")).toBeNull();
  });
  it("maps the row to camelCase", async () => {
    select.mockResolvedValue([
      { datum: "2026-05-31", gezaehlt_cent: 1000, soll_cent: 1230, umsatz_cent: 5000, notiz: "ok" },
    ]);
    expect(await getDailyClose("2026-05-31")).toEqual({
      datum: "2026-05-31", gezaehltCent: 1000, sollCent: 1230, umsatzCent: 5000, notiz: "ok",
    });
  });
});

describe("saveDailyClose", () => {
  it("upserts by datum", async () => {
    execute.mockResolvedValue(undefined);
    await saveDailyClose({
      datum: "2026-05-31", gezaehltCent: 1000, sollCent: 1230, umsatzCent: 5000, notiz: "ok",
    });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO daily_close/i);
    expect(sql).toMatch(/ON CONFLICT\(datum\) DO UPDATE/i);
    expect(params.slice(0, 5)).toEqual(["2026-05-31", 1000, 1230, 5000, "ok"]);
  });
});

describe("listDailyCloses", () => {
  it("maps all rows ordered by datum", async () => {
    select.mockResolvedValue([
      { datum: "2026-05-30", gezaehlt_cent: 100, soll_cent: 100, umsatz_cent: 4000, notiz: null },
      { datum: "2026-05-31", gezaehlt_cent: 200, soll_cent: 200, umsatz_cent: 5000, notiz: "x" },
    ]);
    const { listDailyCloses } = await import("./dailyClose");
    const list = await listDailyCloses();
    expect(list).toHaveLength(2);
    expect(list[0].datum).toBe("2026-05-30");
    expect(list[1].umsatzCent).toBe(5000);
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY datum/i);
  });
});

describe("deleteDailyClose", () => {
  it("deletes by datum", async () => {
    execute.mockResolvedValue(undefined);
    const { deleteDailyClose } = await import("./dailyClose");
    await deleteDailyClose("2026-05-31");
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM daily_close WHERE datum = \$1/i);
    expect(params).toEqual(["2026-05-31"]);
  });
});
