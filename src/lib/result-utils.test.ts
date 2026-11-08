import { describe, it, expect } from "vitest";
import {
  toRows, collectColumns, filterRows, sortRows, compareValues, toCsv, toTsv, RAW_VALUE_COLUMN,
} from "./result-utils";

describe("toRows / collectColumns", () => {
  it("wraps primitives and arrays from SELECT RAW", () => {
    expect(toRows([1, "a", [1], null])).toEqual([
      { [RAW_VALUE_COLUMN]: 1 },
      { [RAW_VALUE_COLUMN]: "a" },
      { [RAW_VALUE_COLUMN]: [1] },
      { [RAW_VALUE_COLUMN]: null },
    ]);
  });

  it("collects the union of keys in first-seen order", () => {
    expect(collectColumns([{ a: 1 }, { b: 2, a: 3 }, { c: 4 }])).toEqual(["a", "b", "c"]);
  });
});

describe("filterRows", () => {
  const rows = [{ name: "Alice", meta: { city: "Paris" } }, { name: "Bob", meta: null }];
  it("matches case-insensitively, including nested JSON", () => {
    expect(filterRows(rows, "paris")).toHaveLength(1);
    expect(filterRows(rows, "BOB")).toEqual([rows[1]]);
  });
  it("returns everything for blank filter", () => {
    expect(filterRows(rows, "  ")).toBe(rows);
  });
});

describe("sortRows", () => {
  it("sorts numbers numerically", () => {
    const rows = [{ n: 10 }, { n: 9 }, { n: 100 }];
    expect(sortRows(rows, "n", "asc").map((r) => r.n)).toEqual([9, 10, 100]);
    expect(sortRows(rows, "n", "desc").map((r) => r.n)).toEqual([100, 10, 9]);
  });

  it("puts MISSING and null before values", () => {
    const rows = [{ n: 1 }, {}, { n: null }];
    expect(sortRows(rows, "n", "asc")).toEqual([{}, { n: null }, { n: 1 }]);
  });

  it("does not mutate the input", () => {
    const rows = [{ n: 2 }, { n: 1 }];
    sortRows(rows, "n", "asc");
    expect(rows[0].n).toBe(2);
  });

  it("compares mixed types by type rank", () => {
    expect(compareValues(1, "1")).toBeLessThan(0);
    expect(compareValues(true, 0)).toBeLessThan(0);
  });
});

describe("CSV / TSV", () => {
  it("escapes commas, quotes, newlines and serialises objects", () => {
    const csv = toCsv([{ a: 'x,"y"', b: { k: 1 }, c: "l1\nl2" }], ["a", "b", "c"]);
    expect(csv).toBe('a,b,c\n"x,""y""","{""k"":1}","l1\nl2"');
  });

  it("emits a header even without rows", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b");
  });

  it("TSV strips tabs/newlines from cells", () => {
    expect(toTsv([{ a: "x\ty\nz" }], ["a"])).toBe("a\nx y z");
  });
});

describe("TSV headers", () => {
  it("cleans tabs and newlines in column names", () => {
    expect(toTsv([{ "a\tb": 1, "c\nd": 2 }], ["a\tb", "c\nd"])).toBe("a b\tc d\n1\t2");
  });
});
