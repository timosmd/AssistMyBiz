import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { getRun, getOrCreateRun, updateItemStates, completeRun, listRuns } from "./runs";
import type { ChecklistTemplate } from "./templates";

beforeEach(() => { select.mockReset(); execute.mockReset(); });

const row = {
  id: 5, template_id: 1, periode: "2026-05-31",
  snapshot_json: '{"name":"Öffnen","frequenz":"taeglich","items":[{"id":"o1","label":"Kasse"}]}',
  item_states_json: '{"o1":true}', notiz: null, abgeschlossen_am: null,
};

describe("getRun", () => {
  it("maps a row to a ChecklistRun or null", async () => {
    select.mockResolvedValueOnce([]);
    expect(await getRun(1, "2026-05-31")).toBeNull();
    select.mockResolvedValueOnce([row]);
    const run = await getRun(1, "2026-05-31");
    expect(run).toEqual({
      id: 5, templateId: 1, periode: "2026-05-31",
      snapshot: { name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }] },
      itemStates: { o1: true }, notiz: null, abgeschlossenAm: null,
    });
  });
});

describe("getOrCreateRun", () => {
  it("inserts a snapshot run when none exists, then returns it", async () => {
    const tmpl: ChecklistTemplate = { id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }] };
    select.mockResolvedValueOnce([]);       // erster getRun -> nichts
    execute.mockResolvedValueOnce(undefined); // insert
    select.mockResolvedValueOnce([row]);    // zweiter getRun -> erstellte Zeile
    const run = await getOrCreateRun(tmpl, "2026-05-31");
    expect(run.id).toBe(5);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT OR IGNORE INTO checklist_runs/i);
    expect(params[0]).toBe(1);
    expect(params[1]).toBe("2026-05-31");
    expect(params[2]).toBe('{"name":"Öffnen","frequenz":"taeglich","items":[{"id":"o1","label":"Kasse"}]}');
  });
});

describe("updateItemStates", () => {
  it("writes the states JSON for a run", async () => {
    execute.mockResolvedValue(undefined);
    await updateItemStates(5, { o1: true });
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE checklist_runs SET item_states_json = \$1 WHERE id = \$2/i);
    expect(params).toEqual(['{"o1":true}', 5]);
  });
});

describe("completeRun", () => {
  it("sets abgeschlossen_am", async () => {
    execute.mockResolvedValue(undefined);
    await completeRun(5);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE checklist_runs SET abgeschlossen_am = \$1 WHERE id = \$2/i);
    expect(params[1]).toBe(5);
  });
});

describe("listRuns", () => {
  it("maps rows ordered by periode desc", async () => {
    select.mockResolvedValue([row]);
    const list = await listRuns();
    expect(list[0].id).toBe(5);
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY periode DESC/i);
  });
});
