import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Receipt } from "@/lib/db/receipts";

const sample: Receipt[] = [
  { id: 1, datum: "2026-05-31", betragCent: 1000, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: "Bäcker", dateiPfad: null, dateiTyp: null },
  { id: 2, datum: "2026-05-30", betragCent: 2000, kategorieId: 2, kategorieName: "Miete", notiz: "Mai", dateiPfad: null, dateiTyp: null },
];
vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => sample),
  deleteReceipt: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/categories", () => ({
  listCategories: vi.fn(async () => [
    { id: 1, name: "Wareneinkauf", isDefault: true, sortOrder: 1 },
    { id: 2, name: "Miete", isDefault: true, sortOrder: 2 },
  ]),
}));

import { ReceiptList } from "./ReceiptList";
import { deleteReceipt } from "@/lib/db/receipts";

describe("ReceiptList", () => {
  it("renders all receipts and filters by search text", async () => {
    render(<ReceiptList reloadKey={0} />);
    expect(await screen.findByText("Bäcker")).toBeInTheDocument();
    expect(screen.getByText("Mai")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/suchen/i), "bäcker");
    expect(screen.getByText("Bäcker")).toBeInTheDocument();
    expect(screen.queryByText("Mai")).not.toBeInTheDocument();
  });

  it("deletes a receipt via its delete button", async () => {
    render(<ReceiptList reloadKey={0} />);
    await screen.findByText("Bäcker");
    await userEvent.click(screen.getByRole("button", { name: /Beleg 1 löschen/i }));
    expect(vi.mocked(deleteReceipt)).toHaveBeenCalledWith(1);
  });
});
