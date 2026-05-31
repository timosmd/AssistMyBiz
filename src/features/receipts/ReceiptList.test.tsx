import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Receipt } from "@/lib/db/receipts";

const sample: Receipt[] = [
  { id: 1, datum: "2026-05-31", betragCent: 1000, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: "Bäcker", dateiPfad: "2026/a.jpg", dateiTyp: "jpg" },
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
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve()) }));

import { ReceiptList } from "./ReceiptList";
import { deleteReceipt } from "@/lib/db/receipts";
import { invoke } from "@tauri-apps/api/core";

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

  it("opens a receipt file via the open button", async () => {
    render(<ReceiptList reloadKey={0} />);
    await screen.findByText("Bäcker");
    await userEvent.click(screen.getByRole("button", { name: /Beleg 1 öffnen/i }));
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("open_receipt_file", { relativePath: "2026/a.jpg" });
  });
});
