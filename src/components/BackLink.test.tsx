import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it("links back to the cockpit home", () => {
    render(<MemoryRouter><BackLink /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /cockpit/i })).toHaveAttribute("href", "/");
  });
});
