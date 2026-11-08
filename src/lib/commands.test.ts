import { describe, it, expect } from "vitest";
import { formatCommandError } from "./commands";

describe("formatCommandError", () => {
  it("formats serialized Rust AppError variants (not [object Object])", () => {
    expect(formatCommandError({ Query: "[3000] syntax error" })).toBe("Query error: [3000] syntax error");
    expect(formatCommandError({ Connection: "refused" })).toBe("Connection error: refused");
  });

  it("passes strings and Errors through", () => {
    expect(formatCommandError("boom")).toBe("boom");
    expect(formatCommandError(new Error("bad"))).toBe("bad");
  });
});
