import { describe, it, expect } from "vitest";
import { adviseStatement, parseAdvice, indexListQuery, describeIndex } from "./indexes";

// Shape returned by Couchbase 7.x
const sample = [
  {
    "#operator": "Advise",
    advice: {
      "#operator": "IndexAdvice",
      adviseinfo: {
        current_indexes: [{ index_statement: "CREATE PRIMARY INDEX def_primary ON `b`", index_status: "PRIMARY INDEX" }],
        recommended_indexes: {
          indexes: [{ index_statement: "CREATE INDEX adv_type ON `b`(`type`)", recommending_rule: "Index keys follow order of predicate types" }],
          covering_indexes: [{ index_statement: "CREATE INDEX adv_type_name ON `b`(`type`,`name`)" }],
        },
      },
    },
    query: "SELECT name FROM b WHERE type = 'x'",
  },
];

describe("ADVISE helpers", () => {
  it("prefixes once and drops trailing semicolons", () => {
    expect(adviseStatement("SELECT 1;")).toBe("ADVISE SELECT 1");
    expect(adviseStatement("advise SELECT 1")).toBe("advise SELECT 1");
  });

  it("parses recommended, covering and current indexes", () => {
    const a = parseAdvice(sample);
    expect(a.recommended).toEqual([
      { statement: "CREATE INDEX adv_type ON `b`(`type`)", rule: "Index keys follow order of predicate types", covering: false },
      { statement: "CREATE INDEX adv_type_name ON `b`(`type`,`name`)", rule: undefined, covering: true },
    ]);
    expect(a.current[0].status).toBe("PRIMARY INDEX");
    expect(a.messages).toEqual([]);
  });

  it("returns the advisor message when there is no recommendation", () => {
    const a = parseAdvice([{ advice: { adviseinfo: { recommended_indexes: "No secondary index recommendation at this time." } } }]);
    expect(a.recommended).toEqual([]);
    expect(a.messages).toEqual(["No secondary index recommendation at this time."]);
  });

  it("falls back to a default message for unknown shapes", () => {
    expect(parseAdvice([{}]).messages).toHaveLength(1);
  });
});

describe("index listing", () => {
  it("uses parameters for collections", () => {
    const q = indexListQuery({ bucket: "b", scope: "s", collection: "c" });
    expect(q.parameters).toEqual(["b", "s", "c"]);
    expect(q.statement).toContain("scope_id = $2");
  });

  it("handles the default collection and legacy buckets", () => {
    const q = indexListQuery({ bucket: "b", scope: "_default", collection: "_default" });
    expect(q.parameters).toEqual(["b"]);
    expect(q.statement).toContain("bucket_id IS MISSING");
  });

  it("describes indexes", () => {
    expect(describeIndex({ name: "p", index_key: [], is_primary: true })).toBe("PRIMARY");
    expect(describeIndex({ name: "i", index_key: ["`type`", "`name`"], condition: "(`x` = 1)" }))
      .toBe("(`type`, `name`) WHERE (`x` = 1)");
  });
});
