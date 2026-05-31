import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => []),
  deleteReceipt: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/categories", () => ({ listCategories: vi.fn(async () => []) }));
vi.mock("@/lib/db/dailyClose", () => ({
  getDailyClose: vi.fn(async () => null),
  saveDailyClose: vi.fn(async () => {}),
  listDailyCloses: vi.fn(async () => []),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve()) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:,") } }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: any }) => <div>{children}</div>;
  return { ResponsiveContainer: Pass, BarChart: Pass, Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null };
});

import { TillModule } from "./TillModule";

describe("TillModule", () => {
  it("shows three tabs and the Belege tab by default", async () => {
    render(<TillModule />);
    expect(screen.getByRole("tab", { name: /belege/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tageskasse/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /auswertung/i })).toBeInTheDocument();
    expect(await screen.findByText(/noch keine belege/i)).toBeInTheDocument();
  });

  it("switches to the Tageskasse tab and shows the cash counter", async () => {
    render(<TillModule />);
    await userEvent.click(screen.getByRole("tab", { name: /tageskasse/i }));
    expect(await screen.findByText(/gezählt \(ist\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tagesabschluss speichern/i })).toBeInTheDocument();
  });

  it("switches to the Auswertung tab and shows the dashboard + export", async () => {
    render(<TillModule />);
    await userEvent.click(screen.getByRole("tab", { name: /auswertung/i }));
    expect(await screen.findByText(/Umsatz \(Summe\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportieren/i })).toBeInTheDocument();
  });
});
