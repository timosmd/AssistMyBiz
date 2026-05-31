import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listArticles, addArticle, setBestand, deleteArticle } from "./articles";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("listArticles", () => {
  it("maps rows ordered by name", async () => {
    select.mockResolvedValue([
      { id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" },
    ]);
    const list = await listArticles();
    expect(list[0]).toEqual({ id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY name/i);
  });
});

describe("addArticle", () => {
  it("inserts the fields", async () => {
    execute.mockResolvedValue(undefined);
    await addArticle({ name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO articles/i);
    expect(params.slice(0, 5)).toEqual(["Mehl", 5, 3, "kg", "Müller"]);
  });
});

describe("setBestand", () => {
  it("updates bestand by id", async () => {
    execute.mockResolvedValue(undefined);
    await setBestand(7, 9);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE articles SET bestand = \$1 WHERE id = \$2/i);
    expect(params).toEqual([9, 7]);
  });
});

describe("deleteArticle", () => {
  it("deletes by id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteArticle(7);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM articles WHERE id = \$1/i);
    expect(params).toEqual([7]);
  });
});
