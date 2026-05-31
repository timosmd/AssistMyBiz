import { describe, it, expect } from "vitest";
import { buildScanUrl } from "./scanUrl";

describe("buildScanUrl", () => {
  it("builds the /scan URL with ip, port and token", () => {
    expect(buildScanUrl({ ip: "192.168.0.5", port: 51234, token: "abc" }))
      .toBe("http://192.168.0.5:51234/scan?token=abc");
  });
});
