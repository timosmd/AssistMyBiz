import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addArticle = vi.fn();
vi.mock("@/lib/db/articles", () => ({ addArticle: (...a: unknown[]) => addArticle(...a) }));

import { ArticleForm } from "./ArticleForm";

beforeEach(() => addArticle.mockReset());

describe("ArticleForm", () => {
  it("blocks saving without a name", async () => {
    render(<ArticleForm onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addArticle).not.toHaveBeenCalled();
    expect(screen.getByText(/namen eingeben/i)).toBeInTheDocument();
  });

  it("adds an article with the entered fields", async () => {
    addArticle.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<ArticleForm onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Mehl");
    await userEvent.type(screen.getByLabelText(/mindestbestand/i), "3");
    await userEvent.type(screen.getByLabelText(/lieferant/i), "Müller");
    await userEvent.click(screen.getByRole("button", { name: /hinzufügen/i }));
    expect(addArticle).toHaveBeenCalledTimes(1);
    const arg = addArticle.mock.calls[0][0];
    expect(arg.name).toBe("Mehl");
    expect(arg.mindestbestand).toBe(3);
    expect(arg.lieferant).toBe("Müller");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
