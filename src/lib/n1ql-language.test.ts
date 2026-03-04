// ============================================================
// Nickel Querier — N1QL language definition unit tests
// ============================================================
import { describe, it, expect } from "vitest";
import { N1QL_KEYWORDS, N1QL_SNIPPETS } from "./n1ql-language";

describe("N1QL_KEYWORDS", () => {
  it("is a non-empty array of strings", () => {
    expect(Array.isArray(N1QL_KEYWORDS)).toBe(true);
    expect(N1QL_KEYWORDS.length).toBeGreaterThan(0);
    N1QL_KEYWORDS.forEach((kw) => expect(typeof kw).toBe("string"));
  });

  it("contains essential DML keywords", () => {
    const essential = ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE"];
    essential.forEach((kw) => {
      expect(N1QL_KEYWORDS).toContain(kw);
    });
  });

  it("contains aggregate functions", () => {
    const aggregates = ["COUNT", "SUM", "AVG", "MIN", "MAX"];
    aggregates.forEach((fn) => {
      expect(N1QL_KEYWORDS).toContain(fn);
    });
  });

  it("contains DDL keywords", () => {
    const ddl = ["CREATE", "DROP", "INDEX", "PRIMARY"];
    ddl.forEach((kw) => {
      expect(N1QL_KEYWORDS).toContain(kw);
    });
  });

  it("has no duplicate entries", () => {
    const unique = new Set(N1QL_KEYWORDS);
    expect(unique.size).toBe(N1QL_KEYWORDS.length);
  });

  it("all keywords are uppercase", () => {
    N1QL_KEYWORDS.forEach((kw) => {
      expect(kw).toBe(kw.toUpperCase());
    });
  });
});

describe("N1QL_SNIPPETS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(N1QL_SNIPPETS)).toBe(true);
    expect(N1QL_SNIPPETS.length).toBeGreaterThan(0);
  });

  it("every snippet has a non-empty label and insertText", () => {
    N1QL_SNIPPETS.forEach((snippet) => {
      expect(typeof snippet.label).toBe("string");
      expect((snippet.label as string).length).toBeGreaterThan(0);
      expect(typeof snippet.insertText).toBe("string");
      expect((snippet.insertText as string).length).toBeGreaterThan(0);
    });
  });

  it("includes a select-from snippet", () => {
    const labels = N1QL_SNIPPETS.map((s) => s.label);
    expect(labels).toContain("select-from");
  });

  it("includes an explain snippet", () => {
    const labels = N1QL_SNIPPETS.map((s) => s.label);
    expect(labels).toContain("explain");
  });

  it("snippet labels are unique", () => {
    const labels = N1QL_SNIPPETS.map((s) => s.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});
