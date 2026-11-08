import { describe, it, expect } from "vitest";
import { timestampedName } from "./export";

describe("timestampedName", () => {
  it("formats a sortable timestamp", () => {
    expect(timestampedName("results", "csv", new Date(2026, 0, 2, 3, 4, 5))).toBe("results-20260102-030405.csv");
  });
});
