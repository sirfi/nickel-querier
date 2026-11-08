// ============================================================
// Nickel Querier — EXPLAIN plan helpers
// ============================================================

export type PlanNode = {
  "#operator": string;
  [key: string]: unknown;
};

/** Keys whose values hold child operators in a Couchbase query plan. */
const CHILD_KEYS = ["~children", "~child", "input", "first", "second", "inputs", "scan", "scans"];

const SKIP_KEYS = new Set(["#operator", "#stats", "optimizer_estimates", ...CHILD_KEYS]);

function isOperator(v: unknown): v is PlanNode {
  return typeof v === "object" && v !== null && "#operator" in v;
}

/**
 * EXPLAIN returns `{ plan: {...}, text: "..." }` (and sometimes `cost`,
 * `optimizer_estimates`…). Return the root operator, or null if the value
 * is not a plan.
 */
export function extractPlanRoot(value: unknown): PlanNode | null {
  if (isOperator(value)) return value;
  if (typeof value === "object" && value !== null && "plan" in value) {
    const plan = (value as { plan: unknown }).plan;
    if (isOperator(plan)) return plan;
  }
  return null;
}

export function extractChildren(node: PlanNode): PlanNode[] {
  const children: PlanNode[] = [];
  for (const key of CHILD_KEYS) {
    const v = node[key];
    if (Array.isArray(v)) {
      children.push(...v.filter(isOperator));
    } else if (isOperator(v)) {
      children.push(v);
    }
  }
  return children;
}

export function getDetails(node: PlanNode, max = 6): [string, string][] {
  return Object.entries(node)
    .filter(([k]) => !SKIP_KEYS.has(k))
    .slice(0, max)
    .map(([k, v]) => {
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return [k, s.length > 80 ? s.slice(0, 80) + "…" : s];
    });
}

export function operatorColor(op: string): string {
  const o = op.toUpperCase();
  if (o.includes("SCAN") || o.includes("FETCH")) return "scan";
  if (o.includes("JOIN") || o.includes("NEST")) return "join";
  if (o.includes("FILTER") || o.includes("WHERE")) return "filter";
  if (o.includes("ORDER") || o.includes("SORT")) return "sort";
  if (o.includes("INSERT") || o.includes("UPDATE") || o.includes("DELETE") ||
      o.includes("UPSERT") || o.includes("MERGE")) return "mutate";
  if (o.includes("AGGREGATE") || o.includes("GROUP")) return "aggregate";
  return "default";
}

/** Collect a flat list of operators, used for quick warnings (e.g. PrimaryScan). */
export function walkPlan(root: PlanNode): PlanNode[] {
  const out: PlanNode[] = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    stack.push(...extractChildren(n));
  }
  return out;
}

export function usesPrimaryScan(root: PlanNode): boolean {
  return walkPlan(root).some((n) => /^PrimaryScan/.test(n["#operator"]));
}
