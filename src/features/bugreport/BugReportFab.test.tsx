import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("./sink", () => ({ reportSink: vi.fn() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "0.3.0") }));

import { BugReportFab } from "./BugReportFab";

describe("BugReportFab", () => {
  it("opens the modal when the FAB is clicked", async () => {
    render(
      <MemoryRouter>
        <BugReportFab />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /bug melden/i }));
    expect(screen.getByRole("dialog", { name: /bug melden/i })).toBeInTheDocument();
  });
});
