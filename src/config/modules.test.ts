import { describe, it, expect } from "vitest";
import { MODULES } from "./modules";

describe("MODULES", () => {
  it("defines exactly the four v1 modules in order", () => {
    expect(MODULES.map((m) => m.id)).toEqual([
      "checklists",
      "till",
      "inventory",
      "shifts",
    ]);
  });

  it("each module has title, description and a route path", () => {
    for (const m of MODULES) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.path.startsWith("/")).toBe(true);
    }
  });
});
