import { useState } from "react";
import {
  PlanNode as PlanNodeType,
  extractPlanRoot,
  extractChildren,
  getDetails,
  operatorColor,
  usesPrimaryScan,
} from "../lib/explain";
import "./ExplainViewer.css";

interface Props {
  plan: unknown;
  isLoading?: boolean;
  error?: string | null;
}

type ViewMode = "tree" | "json";

export default function ExplainViewer({ plan, isLoading, error }: Props) {
  const [mode, setMode] = useState<ViewMode>("tree");

  if (isLoading) {
    return <div className="ev-placeholder">Building query plan…</div>;
  }

  if (error) {
    return (
      <div className="ev-placeholder ev-error">
        <div>
          <div className="ev-error-title">✕ EXPLAIN failed</div>
          <pre className="ev-error-body">{error}</pre>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="ev-placeholder">
        Click ⚡ Explain to visualize the query plan.
      </div>
    );
  }

  const root = extractPlanRoot(plan);
  const text =
    typeof plan === "object" && plan !== null && "text" in plan
      ? String((plan as { text: unknown }).text)
      : null;

  return (
    <div className="ev-root">
      <div className="ev-header">
        <span>EXPLAIN Plan</span>
        <span className="ev-header-right">
          {root && usesPrimaryScan(root) && (
            <span
              className="badge badge-warning"
              title="A PrimaryScan reads every document. Consider a secondary index."
            >
              ⚠ PrimaryScan
            </span>
          )}
          <span className="rv-view-toggle">
            {(["tree", "json"] as ViewMode[]).map((m) => (
              <button
                key={m}
                className={`rv-tab ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "tree" ? "⊵ Tree" : "{ } JSON"}
              </button>
            ))}
          </span>
        </span>
      </div>
      <div className="ev-body">
        {mode === "tree" && root ? (
          <>
            {text && <div className="ev-text" title="Statement">{text}</div>}
            <PlanNode node={root} depth={0} defaultOpen />
          </>
        ) : (
          <pre className="ev-json">{JSON.stringify(plan, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

function PlanNode({
  node,
  depth,
  defaultOpen,
}: {
  node: PlanNodeType;
  depth: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? depth < 6);

  const operator = String(node["#operator"] ?? "Operator");
  const children = extractChildren(node);
  const details = getDetails(node);
  const hasChildren = children.length > 0;

  return (
    <div className="pn-node" style={{ "--depth": depth } as React.CSSProperties}>
      <div
        className={`pn-header ${hasChildren ? "pn-clickable" : ""}`}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren && <span className="pn-chevron">{open ? "▾" : "▸"}</span>}
        <span className={`pn-operator pn-op-${operatorColor(operator)}`}>{operator}</span>
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
