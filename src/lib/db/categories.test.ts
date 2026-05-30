import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listCategories, addCategory } from "./categories";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("listCategories", () => {
  it("returns categories ordered by sort_order", async () => {
    select.mockResolvedValue([
      { id: 1, name: "Wareneinkauf", is_default: 1, sort_order: 1 },
      { id: 6, name: "Sonstiges", is_default: 1, sort_order: 6 },
    ]);
    const cats = await listCategories();
    expect(cats).toHaveLength(2);
    expect(cats[0]).toEqual({ id: 1, name: "Wareneinkauf", isDefault: true, sortOrder: 1 });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY sort_order/i);
  });
});

describe("addCategory", () => {
  it("inserts a custom category at the end", async () => {
    execute.mockResolvedValue(undefined);
    await addCategory("Verpackung");
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO categories/i);
    expect(params[0]).toBe("Verpackung");
  });
});
