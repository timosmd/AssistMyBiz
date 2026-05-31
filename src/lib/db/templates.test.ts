import { describe, it, expect, vi, beforeEach } from "vitest";

const select = vi.fn();
const execute = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ select, execute })) },
}));

import { listTemplates, addTemplate, updateTemplate, deleteTemplate } from "./templates";

beforeEach(() => {
  select.mockReset();
  execute.mockReset();
});

describe("listTemplates", () => {
  it("parses items_json into items[]", async () => {
    select.mockResolvedValue([
      { id: 1, name: "Öffnen", frequenz: "taeglich", items_json: '[{"id":"o1","label":"Kasse"}]' },
    ]);
    const list = await listTemplates();
    expect(list[0]).toEqual({
      id: 1, name: "Öffnen", frequenz: "taeglich", items: [{ id: "o1", label: "Kasse" }],
    });
    const [sql] = select.mock.calls[0];
    expect(sql).toMatch(/ORDER BY name/i);
  });
});

describe("addTemplate", () => {
  it("inserts with items serialized to JSON", async () => {
    execute.mockResolvedValue(undefined);
    await addTemplate("Neu", "woechentlich", [{ id: "x", label: "Punkt" }]);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO checklist_templates/i);
    expect(params.slice(0, 3)).toEqual(["Neu", "woechentlich", '[{"id":"x","label":"Punkt"}]']);
  });
});

describe("updateTemplate", () => {
  it("updates name, frequenz, items by id", async () => {
    execute.mockResolvedValue(undefined);
    await updateTemplate(7, "Neu2", "taeglich", [{ id: "y", label: "P2" }]);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE checklist_templates SET name = \$1, frequenz = \$2, items_json = \$3 WHERE id = \$4/i);
    expect(params).toEqual(["Neu2", "taeglich", '[{"id":"y","label":"P2"}]', 7]);
  });
});

describe("deleteTemplate", () => {
  it("deletes by id", async () => {
    execute.mockResolvedValue(undefined);
    await deleteTemplate(7);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM checklist_templates WHERE id = \$1/i);
    expect(params).toEqual([7]);
  });
});
