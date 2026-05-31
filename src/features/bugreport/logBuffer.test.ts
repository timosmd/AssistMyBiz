import { describe, it, expect, beforeEach, vi } from "vitest";
import { pushLog, getLog, clearLog, logEvent, installConsoleCapture, MAX_LOG } from "./logBuffer";

beforeEach(() => clearLog());

describe("ring buffer", () => {
  it("keeps only the last MAX_LOG lines (FIFO)", () => {
    for (let i = 0; i < MAX_LOG + 10; i++) pushLog(`line ${i}`);
    const log = getLog();
    expect(log).toHaveLength(MAX_LOG);
    expect(log[0]).toBe("line 10");
    expect(log[log.length - 1]).toBe(`line ${MAX_LOG + 9}`);
  });
  it("getLog returns a copy, not the internal array", () => {
    pushLog("a");
    const a = getLog();
    a.push("mutated");
    expect(getLog()).toEqual(["a"]);
  });
  it("logEvent appends a line containing the message", () => {
    logEvent("Beleg gespeichert");
    expect(getLog()[0]).toMatch(/Beleg gespeichert/);
  });
});

describe("installConsoleCapture", () => {
  it("captures console.error into the buffer and is idempotent", () => {
    // Spy BEFORE install so the capture wrapper forwards to the (silent) spy.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    installConsoleCapture();
    installConsoleCapture(); // idempotent
    console.error("boom", 42);
    spy.mockRestore();
    expect(getLog().some((l) => l.includes("boom") && l.includes("42"))).toBe(true);
  });
});
