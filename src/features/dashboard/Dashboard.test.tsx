import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db/receipts", () => ({
  listReceipts: vi.fn(async () => [
    { id: 1, datum: "2026-05-31", betragCent: 1500, kategorieId: 1, kategorieName: "Wareneinkauf", notiz: null, dateiPfad: null, dateiTyp: null },
  ]),
}));
vi.mock("@/lib/db/dailyClose", () => ({
  listDailyCloses: vi.fn(async () => [
    { datum: "2026-05-31", gezaehltCent: 0, sollCent: 0, umsatzCent: 5000, notiz: null },
  ]),
}));
// Recharts in jsdom vereinfachen (keine echte Messung/SVG nötig).
vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: any }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass, BarChart: Pass, Bar: () => null,
    XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
  };
});

import { Dashboard } from "./Dashboard";

describe("Dashboard", () => {
  it("shows the revenue and expenses totals", async () => {
    render(<Dashboard />);
    expect(await screen.findByText(/Umsatz \(Summe\)/i)).toBeInTheDocument();
    expect(screen.getByText(/50,00 €/)).toBeInTheDocument(); // Umsatz
    expect(screen.getByText(/15,00 €/)).toBeInTheDocument(); // Ausgaben
  });
});
