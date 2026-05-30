import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Wallet } from "lucide-react";
import { ModuleTile } from "./ModuleTile";

function renderTile() {
  return render(
    <MemoryRouter>
      <ModuleTile title="Tageskasse" description="Kasse & Belege" path="/till" icon={Wallet} />
    </MemoryRouter>
  );
}

describe("ModuleTile", () => {
  it("shows the title and description", () => {
    renderTile();
    expect(screen.getByText("Tageskasse")).toBeInTheDocument();
    expect(screen.getByText("Kasse & Belege")).toBeInTheDocument();
  });

  it("links to its module path", () => {
    renderTile();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/till");
  });
});
