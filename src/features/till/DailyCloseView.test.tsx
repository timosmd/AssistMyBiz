import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const saveDailyClose = vi.fn();
vi.mock("@/lib/db/dailyClose", () => ({
  getDailyClose: vi.fn(async () => null),
  saveDailyClose: (...a: unknown[]) => saveDailyClose(...a),
  listDailyCloses: vi.fn(async () => []),
  deleteDailyClose: vi.fn(async () => {}),
}));

import { DailyCloseView } from "./DailyCloseView";

beforeEach(() => saveDailyClose.mockReset());

describe("DailyCloseView", () => {
  it("shows the difference of counted minus expected and saves cents", async () => {
    saveDailyClose.mockResolvedValue(undefined);
    render(<DailyCloseView />);
    // zähle 5 × 1,00 € = 5,00 € (Stückelung 100 ct)
    await userEvent.type(await screen.findByLabelText(/anzahl 1,00 €/i), "5");
    await userEvent.type(screen.getByLabelText(/soll/i), "12,30");
    // Differenz 5,00 − 12,30 = −7,30 € (Minuszeichen tolerant: Bindestrich oder U+2212)
    expect(screen.getByText(/[-−]7,30 €/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /tagesabschluss speichern/i }));
    expect(saveDailyClose).toHaveBeenCalledTimes(1);
    const arg = saveDailyClose.mock.calls[0][0];
    expect(arg.gezaehltCent).toBe(500);
    expect(arg.sollCent).toBe(1230);
  });
});
