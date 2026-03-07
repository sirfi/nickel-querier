// ============================================================
// Nickel Querier — N1QL Formatter unit tests
// ============================================================
import { describe, it, expect } from "vitest";
import { formatN1QL } from "./n1ql-formatter";

describe("formatN1QL", () => {
  it("returns empty string unchanged", () => {
    expect(formatN1QL("")).toBe("");
    expect(formatN1QL("   ")).toBe("   ");
  });

  it("uppercases select keyword", () => {
    const result = formatN1QL("select 1");
    expect(result).toMatch(/^SELECT/);
  });

  it("puts FROM on its own line", () => {
    const result = formatN1QL("select * from `bucket`");
    const lines = result.split("\n");
    expect(lines.some((l) => l.trimStart().startsWith("FROM"))).toBe(true);
  });

  it("puts WHERE on its own line", () => {
    const result = formatN1QL("select * from `b` where type = 'doc'");
    const lines = result.split("\n");
    expect(lines.some((l) => l.trimStart().startsWith("WHERE"))).toBe(true);
  });

  it("uppercases AND, OR keywords", () => {
    const result = formatN1QL("select * from `b` where a = 1 and b = 2 or c = 3");
    expect(result).toContain("AND");
    expect(result).toContain("OR");
  });

  it("does not modify backtick-quoted identifiers", () => {
    const input = "select * from `my-bucket`";
    const result = formatN1QL(input);
    expect(result).toContain("`my-bucket`");
  });

  it("does not modify string literal contents", () => {
    const input = "select * from `b` where type = 'select from where'";
    const result = formatN1QL(input);
    // The literal 'select from where' should survive unchanged inside the string
    expect(result).toContain("'select from where'");
  });

  it("handles LIMIT keyword", () => {
    const result = formatN1QL("select * from `b` limit 10");
    expect(result).toContain("LIMIT");
  });

  it("handles already-formatted input idempotently (no crash)", () => {
    const input = "SELECT *\nFROM `bucket`\nWHERE type = 'doc'\nLIMIT 10;";
    const result = formatN1QL(input);
    expect(result).toBeTruthy();
    expect(result).toContain("SELECT");
    expect(result).toContain("FROM");
  });
});
