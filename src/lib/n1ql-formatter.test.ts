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

describe("formatN1QL — regressions", () => {
  it("never moves comment text into code", () => {
    const input = "-- Press Ctrl+Shift+E for EXPLAIN\nselect 1";
    const out = formatN1QL(input);
    expect(out.split("\n")[0]).toBe("-- Press Ctrl+Shift+E for EXPLAIN");
    expect(out).toContain("SELECT 1");
  });

  it("leaves block comments untouched", () => {
    const out = formatN1QL("/* select from where */ select 1");
    expect(out).toContain("/* select from where */");
  });

  it("does not uppercase field names that look like keywords", () => {
    const out = formatN1QL("select d.first, d.`key`, d.index, d.value from b d");
    expect(out).toContain("d.first");
    expect(out).toContain("d.index");
    expect(out).toContain("d.value");
  });

  it("does not uppercase object keys", () => {
    expect(formatN1QL('select {"a": 1} from b')).toContain('{ "a": 1 }');
  });

  it("keeps multi-word clauses together", () => {
    const out = formatN1QL("delete from b where x = 1");
    expect(out.split("\n")[0]).toBe("DELETE FROM b");
    const join = formatN1QL("select a from b left outer join c on a.x = c.y");
    expect(join).toContain("\nLEFT OUTER JOIN c ON a.x = c.y");
    expect(formatN1QL("select a from b order by a desc")).toContain("\nORDER BY a DESC");
  });

  it("indents sub-queries", () => {
    const out = formatN1QL("select * from b where x in (select raw y from c)");
    expect(out).toContain("IN (\n  SELECT RAW y\n  FROM c)");
  });

  it("keeps function calls and META() tight", () => {
    const out = formatN1QL("select meta(b).id, count(*) from b");
    expect(out).toContain("meta(b).id, count(*)");
  });

  it("is idempotent", () => {
    const once = formatN1QL("select a, b from `x` where a = 'q' and b > 2 order by a limit 5;");
    expect(formatN1QL(once)).toBe(once);
  });

  it("keeps escaped quotes inside strings", () => {
    const out = formatN1QL("select 'it''s from' as x");
    expect(out).toContain("'it''s from'");
  });

  it("separates multiple statements", () => {
    const out = formatN1QL("select 1; select 2");
    expect(out).toBe("SELECT 1;\n\nSELECT 2");
  });
});

describe("formatN1QL — review fixes", () => {
  it("does not uppercase a field name separated from `.` by a comment", () => {
    expect(formatN1QL("select d./* field */first from b d")).toContain("first");
    expect(formatN1QL("select d./* field */first from b d")).not.toContain("FIRST");
  });

  it("keeps trailing spaces inside quoted identifiers and comments", () => {
    const out = formatN1QL("select 1 as `a `\nfrom b /* x   \n y */");
    expect(out).toContain("`a `");
    expect(out).toContain("/* x   \n y */");
  });

  it("keeps trailing spaces at the end of a line comment", () => {
    expect(formatN1QL("select 1 -- note   ")).toContain("-- note   ");
  });
});
