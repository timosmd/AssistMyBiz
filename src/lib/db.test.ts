import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { getSetting, setSetting } from "./db";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("getSetting", () => {
  it("returns null when no row exists", async () => {
    select.mockResolvedValue([]);
    expect(await getSetting("shopName")).toBeNull();
  });

  it("returns the stored value when a row exists", async () => {
    select.mockResolvedValue([{ value: "Cafe Sonne" }]);
    expect(await getSetting("shopName")).toBe("Cafe Sonne");
  });
});

describe("setSetting", () => {
  it("upserts the key/value pair", async () => {
    execute.mockResolvedValue(undefined);
    await setSetting("shopName", "Cafe Sonne");
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO settings/i);
    expect(sql).toMatch(/ON CONFLICT\(key\) DO UPDATE/i);
    expect(params).toEqual(["shopName", "Cafe Sonne"]);
  });
});
