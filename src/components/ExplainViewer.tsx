import { useState, useEffect } from "react";
import {
  PlanNode as PlanNodeType,
  extractPlanRoot,
  extractChildren,
  getDetails,
  operatorColor,
  usesPrimaryScan,
} from "../lib/explain";
import PlanDiffView from "./PlanDiffView";
import "./ExplainViewer.css";

/** A plan pinned for comparison */
export interface BaselinePlan {
  plan: unknown;
  statement: string;
  pinnedAt: string; // ISO
}

interface Props {
  plan: unknown;
  isLoading?: boolean;
  error?: string | null;
  baseline?: BaselinePlan | null;
  onPinBaseline?: () => void;
  onClearBaseline?: () => void;
}

type ViewMode = "tree" | "json" | "diff";

export default function ExplainViewer({
  plan,
  isLoading,
  error,
  baseline,
  onPinBaseline,
  onClearBaseline,
}: Props) {
  const [mode, setMode] = useState<ViewMode>(baseline ? "diff" : "tree");

  // A new plan while a baseline is pinned: show the comparison right away
  useEffect(() => {
    if (baseline && plan && plan !== baseline.plan) setMode("diff");
  }, [plan, baseline]);

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
  const baselineRoot = baseline ? extractPlanRoot(baseline.plan) : null;
  const canDiff = !!(root && baselineRoot);
  const effectiveMode: ViewMode = mode === "diff" && !canDiff ? "tree" : mode;
  const isPinned = baseline?.plan === plan;
  const text =
    typeof plan === "object" && plan !== null && "text" in plan
      ? String((plan as { text: unknown }).text)
      : null;

  return (
    <div className="ev-root">
      <div className="ev-header">
        <span>
          EXPLAIN Plan
          {baseline && (
            <span className="ev-baseline" title={baseline.statement}>
              {" "}· baseline pinned {new Date(baseline.pinnedAt).toLocaleTimeString()}
            </span>
          )}
        </span>
        <span className="ev-header-right">
          {onPinBaseline && root && !isPinned && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                onPinBaseline();
                setMode("tree");
              }}
              data-tooltip="Keep this plan to compare against the next EXPLAIN (e.g. after creating an index)"
            >
              📌 Pin as baseline
            </button>
          )}
          {baseline && onClearBaseline && (
            <button className="btn btn-ghost" onClick={onClearBaseline} data-tooltip="Forget the pinned plan">
              ✕ Baseline
            </button>
          )}
          {root && usesPrimaryScan(root) && (
            <span
              className="badge badge-warning"
              title="A PrimaryScan reads every document. Consider a secondary index."
            >
              ⚠ PrimaryScan
            </span>
          )}
          <span className="rv-view-toggle">
            {(["tree", "json", "diff"] as ViewMode[]).map((m) => (
              <button
                key={m}
                className={`rv-tab ${effectiveMode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
                disabled={m === "diff" && !canDiff}
                title={m === "diff" && !canDiff ? "Pin a plan as baseline first, then run EXPLAIN again" : undefined}
              >
                {m === "tree" ? "⊵ Tree" : m === "json" ? "{ } JSON" : "⇄ Compare"}
              </button>
            ))}
          </span>
        </span>
      </div>
      <div className="ev-body">
        {effectiveMode === "diff" && root && baselineRoot ? (
          <PlanDiffView
            before={baselineRoot}
            after={root}
            beforeLabel="Baseline"
            afterLabel={isPinned ? "Baseline (same plan)" : "Current"}
          />
        ) : effectiveMode === "tree" && root ? (
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
