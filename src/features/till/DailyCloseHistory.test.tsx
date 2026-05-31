import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const deleteDailyClose = vi.fn();
vi.mock("@/lib/db/dailyClose", () => ({
  listDailyCloses: vi.fn(async () => [
    { datum: "2026-05-31", gezaehltCent: 1000, sollCent: 1230, umsatzCent: 5000, notiz: null },
  ]),
  deleteDailyClose: (...a: unknown[]) => deleteDailyClose(...a),
}));
import { DailyCloseHistory } from "./DailyCloseHistory";

describe("DailyCloseHistory", () => {
  it("lists closes and supports edit + delete", async () => {
    const onEdit = vi.fn();
    render(<DailyCloseHistory reloadKey={0} onEdit={onEdit} />);
    expect(await screen.findByText("2026-05-31")).toBeInTheDocument();
    expect(screen.getByText(/50,00 €/)).toBeInTheDocument(); // Umsatz
    await userEvent.click(screen.getByRole("button", { name: /2026-05-31 bearbeiten/i }));
    expect(onEdit).toHaveBeenCalledWith("2026-05-31");
    await userEvent.click(screen.getByRole("button", { name: /2026-05-31 löschen/i }));
    expect(deleteDailyClose).toHaveBeenCalledWith("2026-05-31");
  });
});
