import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invoke = vi.fn();
const listen = vi.fn(async () => () => {});
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: (...a: Parameters<typeof listen>) => listen(...a) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,xxx") } }));

import { ScanPanel } from "./ScanPanel";

beforeEach(() => { invoke.mockReset(); listen.mockClear(); });

describe("ScanPanel", () => {
  it("starts a session and shows a QR code", async () => {
    invoke.mockResolvedValue({ ip: "192.168.0.5", port: 51234, token: "abc" });
    render(<ScanPanel onScanned={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /mit handy scannen/i }));
    expect(invoke).toHaveBeenCalledWith("start_scan_session");
    expect(await screen.findByRole("img", { name: /qr-code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan beenden/i })).toBeInTheDocument();
  });
});
