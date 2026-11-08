import { describe, it, expect } from "vitest";
import { extractPlanRoot, extractChildren, usesPrimaryScan, getDetails } from "./explain";

// Shape of a real Couchbase 7.x EXPLAIN response row
const explainRow = {
  plan: {
    "#operator": "Sequence",
    "~children": [
      {
        "#operator": "Authorize",
        "~child": {
          "#operator": "Sequence",
          "~children": [
            { "#operator": "PrimaryScan3", index: "#primary", keyspace: "b" },
            {
              "#operator": "Parallel",
              "~child": {
                "#operator": "Sequence",
                "~children": [{ "#operator": "Fetch" }, { "#operator": "InitialProject" }],
              },
            },
          ],
        },
      },
      { "#operator": "Stream" },
    ],
  },
  text: "SELECT * FROM b",
};

describe("explain helpers", () => {
  it("unwraps the plan from an EXPLAIN result row", () => {
    expect(extractPlanRoot(explainRow)?.["#operator"]).toBe("Sequence");
  });

  it("returns null for non-plan values", () => {
    expect(extractPlanRoot({ foo: 1 })).toBeNull();
    expect(extractPlanRoot(null)).toBeNull();
  });

  it("follows ~child (Authorize / Parallel)", () => {
    const authorize = (explainRow.plan["~children"] as never[])[0];
    expect(extractChildren(authorize).map((c) => c["#operator"])).toEqual(["Sequence"]);
  });

  it("follows scan / scans of IntersectScan / DistinctScan", () => {
    const node = {
      "#operator": "IntersectScan",
      scans: [{ "#operator": "IndexScan3" }, { "#operator": "IndexScan3" }],
    };
    expect(extractChildren(node)).toHaveLength(2);
    expect(extractChildren({ "#operator": "DistinctScan", scan: { "#operator": "IndexScan3" } }))
      .toHaveLength(1);
  });

  it("detects primary scans anywhere in the tree", () => {
    expect(usesPrimaryScan(extractPlanRoot(explainRow)!)).toBe(true);
    expect(usesPrimaryScan({ "#operator": "IndexScan3" })).toBe(false);
  });

  it("details skip child keys", () => {
    const d = getDetails({ "#operator": "IndexScan3", index: "idx", "~child": { "#operator": "X" } });
    expect(d).toEqual([["index", "idx"]]);
  });
});
