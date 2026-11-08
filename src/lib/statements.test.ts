import { describe, it, expect } from "vitest";
import { splitStatements, statementAtOffset } from "./statements";

const sql = "SELECT 1;\nSELECT ';' AS x;\n\n-- note\nSELECT 3";

describe("splitStatements", () => {
  it("splits on semicolons outside literals and drops empty parts", () => {
    expect(splitStatements(sql).map((s) => s.text.trim())).toEqual([
      "SELECT 1;",
      "SELECT ';' AS x;",
      "-- note\nSELECT 3",
    ]);
    expect(splitStatements("SELECT 1;;  ")).toHaveLength(1);
  });
});

describe("statementAtOffset", () => {
  const at = (needle: string, delta = 0) =>
    statementAtOffset(sql, sql.indexOf(needle) + delta)?.text.trim();

  it("returns the statement containing the cursor", () => {
    expect(at("SELECT 1")).toBe("SELECT 1;");
    expect(at("AS x")).toBe("SELECT ';' AS x;");
    expect(at("SELECT 3", 3)).toBe("-- note\nSELECT 3");
  });

  it("treats the cursor right after `;` as the previous statement", () => {
    expect(statementAtOffset(sql, sql.indexOf(";") + 1)?.text.trim()).toBe("SELECT 1;");
  });

  it("returns null for empty input", () => {
    expect(statementAtOffset("  -- only a comment", 3)).toBeNull();
  });
});
