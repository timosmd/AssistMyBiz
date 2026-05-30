import { vi } from "vitest";
vi.mock("@/lib/db", () => ({
  getSetting: vi.fn(async () => null),
  setSetting: vi.fn(async () => {}),
}));

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Cockpit } from "./Cockpit";

describe("Cockpit", () => {
  it("renders one tile per module (four links)", () => {
    render(
      <MemoryRouter>
        <Cockpit />
      </MemoryRouter>
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByText("Tageskasse & Belege")).toBeInTheDocument();
  });
});
