import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const reportSink = vi.fn();
vi.mock("./sink", () => ({ reportSink: (...a: unknown[]) => reportSink(...a) }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "0.3.0") }));

import { BugReportModal } from "./BugReportModal";

beforeEach(() => reportSink.mockReset());

function renderModal() {
  return render(
    <MemoryRouter initialEntries={["/till"]}>
      <BugReportModal onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("BugReportModal", () => {
  it("blocks sending with an empty description", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    expect(reportSink).not.toHaveBeenCalled();
    expect(screen.getByText(/bitte eine beschreibung/i)).toBeInTheDocument();
  });

  it("sends a report with description, priority and route", async () => {
    reportSink.mockResolvedValue(undefined);
    renderModal();
    await userEvent.type(screen.getByLabelText(/beschreibung/i), "Speichern hängt");
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    expect(reportSink).toHaveBeenCalledTimes(1);
    const arg = reportSink.mock.calls[0][0];
    expect(arg.beschreibung).toBe("Speichern hängt");
    expect(arg.route).toBe("/till");
    expect(arg.prio).toBe("Mittel");
  });

  it("closes itself after a successful send", async () => {
    reportSink.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/till"]}>
        <BugReportModal onClose={onClose} />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/beschreibung/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("shows an error when the sink rejects", async () => {
    reportSink.mockImplementationOnce(async () => {
      throw new Error("write failed");
    });
    renderModal();
    await userEvent.type(screen.getByLabelText(/beschreibung/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /senden/i }));
    expect(await screen.findByText(/konnte den report nicht speichern/i)).toBeInTheDocument();
  });
});
