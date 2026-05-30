import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const addReceipt = vi.fn();
vi.mock("@/lib/db/receipts", () => ({ addReceipt: (...a: unknown[]) => addReceipt(...a) }));
vi.mock("@/lib/db/categories", () => ({
  listCategories: vi.fn(async () => [{ id: 1, name: "Wareneinkauf", isDefault: true, sortOrder: 1 }]),
}));

import { ReceiptForm } from "./ReceiptForm";

beforeEach(() => addReceipt.mockReset());

describe("ReceiptForm", () => {
  it("blocks saving when the amount is empty/invalid", async () => {
    render(<ReceiptForm onSaved={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /speichern/i }));
    expect(addReceipt).not.toHaveBeenCalled();
    expect(screen.getByText(/gültigen betrag/i)).toBeInTheDocument();
  });

  it("saves a receipt with parsed cents", async () => {
    addReceipt.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(<ReceiptForm onSaved={onSaved} />);
    await userEvent.type(await screen.findByLabelText(/betrag/i), "12,34");
    await userEvent.click(screen.getByRole("button", { name: /speichern/i }));
    expect(addReceipt).toHaveBeenCalledTimes(1);
    expect(addReceipt.mock.calls[0][0].betragCent).toBe(1234);
  });
});
