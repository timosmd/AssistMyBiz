import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Article } from "@/lib/db/articles";
import { setBestand, deleteArticle } from "@/lib/db/articles";

const sample: Article[] = [
  { id: 1, name: "Mehl", bestand: 5, mindestbestand: 3, einheit: "kg", lieferant: "Müller" },
  { id: 2, name: "Zucker", bestand: 2, mindestbestand: 4, einheit: "kg", lieferant: "Hofer" },
];
vi.mock("@/lib/db/articles", () => ({
  listArticles: vi.fn(async () => sample),
  setBestand: vi.fn(async () => {}),
  deleteArticle: vi.fn(async () => {}),
}));

import { ArticleList } from "./ArticleList";

describe("ArticleList", () => {
  it("lists articles, marks low stock, filters, increments and deletes", async () => {
    render(<ArticleList reloadKey={0} />);
    expect(await screen.findByText("Mehl")).toBeInTheDocument();
    // Zucker (2 <= 4) ist low-stock -> genau eine „nachbestellen"-Markierung (Mehl 5>3 nicht)
    expect(screen.getByText(/nachbestellen/i)).toBeInTheDocument();
    // + erhöht Mehl von 5 auf 6
    await userEvent.click(screen.getByRole("button", { name: /Mehl Bestand erhöhen/i }));
    expect(vi.mocked(setBestand)).toHaveBeenCalledWith(1, 6);
    // löschen
    await userEvent.click(screen.getByRole("button", { name: /Mehl löschen/i }));
    expect(vi.mocked(deleteArticle)).toHaveBeenCalledWith(1);
    // filtern
    await userEvent.type(screen.getByLabelText(/suchen/i), "zucker");
    expect(screen.queryByText("Mehl")).not.toBeInTheDocument();
  });
});
