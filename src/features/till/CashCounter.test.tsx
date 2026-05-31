import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashCounter } from "./CashCounter";

describe("CashCounter", () => {
  it("reports the live total when a denomination count changes", async () => {
    const onTotal = vi.fn();
    render(<CashCounter onTotal={onTotal} />);
    // 2 × 5,00 € = 10,00 € (Stückelung 500 ct)
    await userEvent.type(screen.getByLabelText(/anzahl 5,00 €/i), "2");
    expect(onTotal).toHaveBeenLastCalledWith(1000);
    expect(screen.getAllByText(/10,00 €/).length).toBeGreaterThanOrEqual(1);
  });
});
