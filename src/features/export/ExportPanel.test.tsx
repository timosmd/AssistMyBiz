import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invoke = vi.fn();
const open = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...a: unknown[]) => open(...a) }));
vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => [
    { id: 1, datum: "2026-05-31", betragCent: 1234, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: null, dateiPfad: "2026/a.jpg", dateiTyp: "jpg" },
    { id: 2, datum: "2026-04-15", betragCent: 500, kategorieId: 2, kategorieName: "Miete", notiz: null, dateiPfad: null, dateiTyp: null },
  ]),
}));

import { ExportPanel } from "./ExportPanel";

beforeEach(() => { invoke.mockReset(); open.mockReset(); });

describe("ExportPanel", () => {
  it("exports the chosen month to the picked folder", async () => {
    open.mockResolvedValue("C:/export-ziel");
    invoke.mockResolvedValue(1);
    render(<ExportPanel />);
    // type="month" zuverlässig über fireEvent.change setzen
    fireEvent.change(screen.getByLabelText(/monat/i), { target: { value: "2026-05" } });
    await userEvent.click(screen.getByRole("button", { name: /exportieren/i }));
    expect(invoke).toHaveBeenCalledTimes(1);
    const [cmd, args] = invoke.mock.calls[0] as [string, { targetDir: string; files: unknown[]; indexCsv: string }];
    expect(cmd).toBe("export_bookkeeping");
    expect(args.targetDir).toBe("C:/export-ziel");
    expect(args.files).toHaveLength(1); // nur der Mai-Beleg mit Datei
    expect(args.indexCsv).toMatch(/Wareneinkauf;12,34/);
  });

  it("does nothing if the folder dialog is cancelled", async () => {
    open.mockResolvedValue(null);
    render(<ExportPanel />);
    await userEvent.click(screen.getByRole("button", { name: /exportieren/i }));
    expect(invoke).not.toHaveBeenCalled();
  });
});
