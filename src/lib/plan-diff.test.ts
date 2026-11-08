import { describe, it, expect } from "vitest";
import { flattenPlan, diffPlans, summarizePlan, diffStats } from "./plan-diff";
import type { PlanNode } from "./explain";

// Before: primary scan + filter.  After: secondary index scan, no filter.
const before: PlanNode = {
  "#operator": "Sequence",
  "~children": [
    { "#operator": "PrimaryScan3", index: "#primary", keyspace: "b" },
    { "#operator": "Fetch", keyspace: "b" },
    { "#operator": "Filter", condition: "(`b`.`type` = \"x\")" },
    { "#operator": "InitialProject" },
  ],
};
const after: PlanNode = {
  "#operator": "Sequence",
  "~children": [
    { "#operator": "IndexScan3", index: "idx_type", keyspace: "b", "#stats": { "#itemsOut": 3 } },
    { "#operator": "Fetch", keyspace: "b" },
    { "#operator": "InitialProject" },
  ],
};

describe("flattenPlan", () => {
  it("walks the tree in pre-order with depth and ignores stats", () => {
    const steps = flattenPlan(after);
    expect(steps.map((s) => [s.depth, s.op])).toEqual([
      [0, "Sequence"], [1, "IndexScan3"], [1, "Fetch"], [1, "InitialProject"],
    ]);
    expect(steps[1].props).toEqual({ index: "idx_type", keyspace: "b" });
  });
});

describe("diffPlans", () => {
  it("aligns common operators and marks added / removed ones", () => {
    const rows = diffPlans(before, after);
    expect(rows.map((r) => [r.kind, r.left?.op ?? null, r.right?.op ?? null])).toEqual([
      ["same", "Sequence", "Sequence"],
      ["removed", "PrimaryScan3", null],
      ["added", null, "IndexScan3"],
      ["same", "Fetch", "Fetch"],
      ["removed", "Filter", null],
      ["same", "InitialProject", "InitialProject"],
    ]);
    expect(diffStats(rows)).toEqual({ same: 3, changed: 0, added: 1, removed: 2 });
  });

  it("marks the same operator with different properties as changed", () => {
    const a: PlanNode = { "#operator": "IndexScan3", index: "idx_a" };
    const b: PlanNode = { "#operator": "IndexScan3", index: "idx_b" };
    expect(diffPlans(a, b)).toEqual([
      { kind: "changed", left: flattenPlan(a)[0], right: flattenPlan(b)[0], changedKeys: ["index"] },
    ]);
  });

  it("identical plans are all same", () => {
    expect(diffStats(diffPlans(after, after))).toEqual({ same: 4, changed: 0, added: 0, removed: 0 });
  });
});

describe("summarizePlan", () => {
  it("lists indexes and flags primary scans", () => {
    expect(summarizePlan(before)).toEqual({ operators: 5, indexes: ["#primary"], primaryScan: true, fetches: 1 });
    expect(summarizePlan(after)).toEqual({ operators: 4, indexes: ["idx_type"], primaryScan: false, fetches: 1 });
  });
});
