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
