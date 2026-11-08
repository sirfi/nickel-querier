// ============================================================
// Nickel Querier — EXPLAIN plan comparison
// ============================================================
import { PlanNode, extractChildren } from "./explain";

/** One operator of a plan, in pre-order (parents before children). */
export interface PlanStep {
  depth: number;
  op: string;
  /** Comparable properties (index, keyspace, spans, …) as short strings */
  props: Record<string, string>;
}

const CHILD_KEYS = new Set(["~children", "~child", "input", "first", "second", "inputs", "scan", "scans"]);
const IGNORED_KEYS = new Set(["#operator", "#stats", "optimizer_estimates", "#time", ...CHILD_KEYS]);

function short(v: unknown): string {
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 120 ? s.slice(0, 120) + "…" : s;
}

export function flattenPlan(root: PlanNode): PlanStep[] {
  const out: PlanStep[] = [];
  const walk = (node: PlanNode, depth: number) => {
    const props: Record<string, string> = {};
    for (const [k, v] of Object.entries(node)) {
      if (!IGNORED_KEYS.has(k)) props[k] = short(v);
    }
    out.push({ depth, op: String(node["#operator"]), props });
    for (const child of extractChildren(node)) walk(child, depth + 1);
  };
  walk(root, 0);
  return out;
}

export type DiffKind = "same" | "changed" | "added" | "removed";

export interface DiffRow {
  kind: DiffKind;
  left?: PlanStep;
  right?: PlanStep;
  /** For "changed": property names whose values differ */
  changedKeys?: string[];
}

function changedKeys(a: PlanStep, b: PlanStep): string[] {
  const keys = new Set([...Object.keys(a.props), ...Object.keys(b.props)]);
  return [...keys].filter((k) => a.props[k] !== b.props[k]).sort();
}

/**
 * Align two plans operator by operator (longest common subsequence on the
 * operator names) and classify each row as same / changed / added / removed.
 */
export function diffPlans(before: PlanNode, after: PlanNode): DiffRow[] {
  const a = flattenPlan(before);
  const b = flattenPlan(after);
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i].op === b[j].op ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].op === b[j].op) {
      const keys = changedKeys(a[i], b[j]);
      rows.push(keys.length ? { kind: "changed", left: a[i], right: b[j], changedKeys: keys } : { kind: "same", left: a[i], right: b[j] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ kind: "removed", left: a[i++] });
    } else {
      rows.push({ kind: "added", right: b[j++] });
    }
  }
  while (i < n) rows.push({ kind: "removed", left: a[i++] });
  while (j < m) rows.push({ kind: "added", right: b[j++] });
  return rows;
}

export interface PlanSummary {
  operators: number;
  /** Index names used by scans, in plan order */
  indexes: string[];
  primaryScan: boolean;
  fetches: number;
}

export function summarizePlan(root: PlanNode): PlanSummary {
  const steps = flattenPlan(root);
  const indexes: string[] = [];
  for (const s of steps) {
    const idx = s.props.index;
    if (idx && /Scan/i.test(s.op) && !indexes.includes(idx)) indexes.push(idx);
  }
  return {
    operators: steps.length,
    indexes,
    primaryScan: steps.some((s) => /^PrimaryScan/.test(s.op)),
    fetches: steps.filter((s) => /^Fetch/.test(s.op)).length,
  };
}

export function diffStats(rows: DiffRow[]): Record<DiffKind, number> {
  const stats: Record<DiffKind, number> = { same: 0, changed: 0, added: 0, removed: 0 };
  for (const r of rows) stats[r.kind]++;
  return stats;
}
