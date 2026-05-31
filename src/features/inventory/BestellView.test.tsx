import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Article } from "@/lib/db/articles";

const invoke = vi.fn();
const open = vi.fn();
const listArticles = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (...a: unknown[]) => open(...a) }));
vi.mock("@/lib/db/articles", () => ({ listArticles: (...a: unknown[]) => listArticles(...a) }));

import { BestellView } from "./BestellView";

function art(p: Partial<Article>): Article {
  return { id: 1, name: "X", bestand: 0, mindestbestand: 0, einheit: null, lieferant: null, ...p };
}

beforeEach(() => { invoke.mockReset(); open.mockReset(); listArticles.mockReset(); });

describe("BestellView", () => {
  it("zeigt nachzubestellende Artikel nach Lieferant gruppiert", async () => {
    listArticles.mockResolvedValue([
      art({ id: 1, name: "Apfel", bestand: 1, mindestbestand: 5, einheit: "kg", lieferant: "Metro" }),
      art({ id: 2, name: "Genug", bestand: 9, mindestbestand: 5, lieferant: "Metro" }),
    ]);
    render(<BestellView />);
    expect(await screen.findByText("Metro")).toBeInTheDocument();
    expect(screen.getByText("Apfel")).toBeInTheDocument();
    expect(screen.queryByText("Genug")).not.toBeInTheDocument();
  });

  it("zeigt einen Leer-Zustand, wenn alles bestückt ist", async () => {
    listArticles.mockResolvedValue([art({ id: 1, name: "Genug", bestand: 9, mindestbestand: 5 })]);
    render(<BestellView />);
    expect(await screen.findByText(/ausreichend bestückt/i)).toBeInTheDocument();
  });

  it("exportiert die Liste in den gewählten Ordner", async () => {
    listArticles.mockResolvedValue([
      art({ id: 1, name: "Apfel", bestand: 1, mindestbestand: 5, lieferant: "Metro" }),
    ]);
    open.mockResolvedValue("C:/bestell-ziel");
    invoke.mockResolvedValue(undefined);
    render(<BestellView />);
    await screen.findByText("Metro");
    await userEvent.click(screen.getByRole("button", { name: /exportieren/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [cmd, args] = invoke.mock.calls[0] as [string, { targetDir: string; content: string }];
    expect(cmd).toBe("export_reorder");
    expect(args.targetDir).toBe("C:/bestell-ziel");
    expect(args.content).toContain("Apfel");
  });

  it("exportiert nichts, wenn der Dialog abgebrochen wird", async () => {
    listArticles.mockResolvedValue([
      art({ id: 1, name: "Apfel", bestand: 1, mindestbestand: 5, lieferant: "Metro" }),
    ]);
    open.mockResolvedValue(null);
    render(<BestellView />);
    await screen.findByText("Metro");
    await userEvent.click(screen.getByRole("button", { name: /exportieren/i }));
    expect(invoke).not.toHaveBeenCalled();
  });
});
