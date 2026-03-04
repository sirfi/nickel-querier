import { useState } from "react";
import "./ExplainViewer.css";

interface Props {
  plan: unknown;
}

type NodeOp = {
  "#operator": string;
  [key: string]: unknown;
};

export default function ExplainViewer({ plan }: Props) {
  if (!plan) {
    return (
      <div className="ev-placeholder">
        Click ⚡ Explain to visualize the query plan.
      </div>
    );
  }

  return (
    <div className="ev-root">
      <div className="ev-header">
        <span>EXPLAIN Plan</span>
        <span className="ev-hint">Expand nodes to see details</span>
      </div>
      <div className="ev-body">
        <PlanNode node={plan as NodeOp} depth={0} defaultOpen />
      </div>
    </div>
  );
}

function PlanNode({
  node,
  depth,
  defaultOpen,
}: {
  node: NodeOp;
  depth: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? depth < 2);

  const operator = node["#operator"] ?? "Operator";
  const children: NodeOp[] = extractChildren(node);
  const details = getDetails(node);
  const hasChildren = children.length > 0;

  return (
    <div className="pn-node" style={{ "--depth": depth } as React.CSSProperties}>
      <div
        className={`pn-header ${hasChildren ? "pn-clickable" : ""}`}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren && (
          <span className="pn-chevron">{open ? "▾" : "▸"}</span>
        )}
        <span className={`pn-operator pn-op-${operatorColor(String(operator))}`}>
          {String(operator)}
        </span>
        {details.map(([k, v]) => (
          <span key={k} className="pn-detail">
            <span className="pn-detail-key">{k}=</span>
            <span className="pn-detail-val">{v}</span>
          </span>
        ))}
      </div>

      {open && hasChildren && (
        <div className="pn-children">
          {children.map((child, i) => (
            <PlanNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function extractChildren(node: NodeOp): NodeOp[] {
  const children: NodeOp[] = [];
  for (const key of [
    "~children",
    "input",
    "first",
    "second",
    "inputs",
  ]) {
    const v = node[key];
    if (Array.isArray(v)) {
      children.push(...(v as NodeOp[]));
    } else if (v && typeof v === "object" && "#operator" in (v as object)) {
      children.push(v as NodeOp);
    }
  }
  return children;
}

const SKIP_KEYS = new Set([
  "#operator",
  "~children",
  "input",
  "first",
  "second",
  "inputs",
  "#stats",
]);

function getDetails(node: NodeOp): [string, string][] {
  return Object.entries(node)
    .filter(([k]) => !SKIP_KEYS.has(k))
    .slice(0, 5)
    .map(([k, v]) => [
      k,
      typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v),
    ]);
}

function operatorColor(op: string): string {
  const op2 = op.toUpperCase();
  if (op2.includes("SCAN") || op2.includes("FETCH")) return "scan";
  if (op2.includes("JOIN") || op2.includes("NEST")) return "join";
  if (op2.includes("FILTER") || op2.includes("WHERE")) return "filter";
  if (op2.includes("ORDER") || op2.includes("SORT")) return "sort";
  if (op2.includes("INSERT") || op2.includes("UPDATE") || op2.includes("DELETE")) return "mutate";
  if (op2.includes("AGGREGATE") || op2.includes("GROUP")) return "aggregate";
  return "default";
}
