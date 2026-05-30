import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { addReceipt, listReceipts, deleteReceipt } from "./receipts";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("addReceipt", () => {
  it("inserts a receipt with cents and the given fields", async () => {
    execute.mockResolvedValue(undefined);
    await addReceipt({
      datum: "2026-05-31",
      betragCent: 1234,
      kategorieId: 1,
      notiz: "Bäcker",
      dateiPfad: "2026/abc.jpg",
      dateiTyp: "jpg",
    });
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO receipts/i);
    expect(params.slice(0, 6)).toEqual(["2026-05-31", 1234, 1, "Bäcker", "2026/abc.jpg", "jpg"]);
  });
});

describe("listReceipts", () => {
  it("maps rows and joins the category name", async () => {
    select.mockResolvedValue([
      {
        id: 7,
        datum: "2026-05-31",
        betrag_cent: 1234,
        kategorie_id: 1,
        kategorie_name: "Wareneinkauf",
        notiz: "Bäcker",
        datei_pfad: "2026/abc.jpg",
        datei_typ: "jpg",
      },
    ]);
    const list = await listReceipts();
    expect(list[0]).toEqual({
      id: 7,
      datum: "2026-05-31",
      betragCent: 1234,
      kategorieId: 1,
      kategorieName: "Wareneinkauf",
      notiz: "Bäcker",
      dateiPfad: "2026/abc.jpg",
      dateiTyp: "jpg",
    });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY datum DESC/i);
  });
});

describe("deleteReceipt", () => {
  it("deletes by id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteReceipt(7);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM receipts WHERE id = \$1/i);
    expect(params).toEqual([7]);
  });
});
