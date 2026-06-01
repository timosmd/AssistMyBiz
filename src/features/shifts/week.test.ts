import { describe, it, expect } from "vitest";
import { weekDays, weekLabel, addWeeks } from "./week";

describe("weekDays", () => {
  it("liefert Mo..So der ISO-Woche als ISO-Daten", () => {
    // Mittwoch 2026-06-03 -> Woche Mo 01.06 .. So 07.06
    const days = weekDays(new Date(2026, 5, 3));
    expect(days).toEqual([
      "2026-06-01", "2026-06-02", "2026-06-03",
      "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07",
    ]);
  });
  it("behandelt Sonntag als letzten Tag derselben Woche", () => {
    const days = weekDays(new Date(2026, 5, 7)); // So
    expect(days[0]).toBe("2026-06-01");
    expect(days[6]).toBe("2026-06-07");
  });
  it("funktioniert über Monats-/Jahresgrenzen", () => {
    const days = weekDays(new Date(2026, 11, 31)); // Do 31.12.2026
    expect(days[0]).toBe("2026-12-28");
    expect(days[6]).toBe("2027-01-03");
  });
});

describe("addWeeks", () => {
  it("verschiebt um n Wochen", () => {
    expect(weekDays(addWeeks(new Date(2026, 5, 3), 1))[0]).toBe("2026-06-08");
    expect(weekDays(addWeeks(new Date(2026, 5, 3), -1))[0]).toBe("2026-05-25");
  });
});

describe("weekLabel", () => {
  it("zeigt KW-Nummer und Datumsspanne", () => {
    expect(weekLabel(new Date(2026, 5, 3))).toBe("KW 23 · 01.–07.06.2026");
  });
});
