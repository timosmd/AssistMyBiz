import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/db/articles", () => ({
  listArticles: vi.fn(async () => []),
  addArticle: vi.fn(async () => {}),
  setBestand: vi.fn(async () => {}),
  deleteArticle: vi.fn(async () => {}),
}));

import { InventoryModule } from "./InventoryModule";

describe("InventoryModule", () => {
  it("shows the Artikel tab by default and a back link", async () => {
    render(<MemoryRouter><InventoryModule /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /artikel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hinzufügen/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine artikel/i)).toBeInTheDocument();
  });

  it("switches to the Bestellung placeholder tab", async () => {
    render(<MemoryRouter><InventoryModule /></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /bestellung/i }));
    expect(screen.getByText(/bald verfügbar/i)).toBeInTheDocument();
  });
});
