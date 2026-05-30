import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => []),
  deleteReceipt: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/categories", () => ({ listCategories: vi.fn(async () => []) }));

import { TillModule } from "./TillModule";

describe("TillModule", () => {
  it("shows three tabs and the Belege tab by default", async () => {
    render(<TillModule />);
    expect(screen.getByRole("tab", { name: /belege/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tageskasse/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /auswertung/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine belege/i)).toBeInTheDocument();
  });

  it("switches to the Tageskasse tab placeholder", async () => {
    render(<TillModule />);
    await userEvent.click(screen.getByRole("tab", { name: /tageskasse/i }));
    expect(screen.getByText(/bald verfügbar/i)).toBeInTheDocument();
  });
});
