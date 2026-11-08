import { useMemo, useState } from "react";
import { PlanNode } from "../lib/explain";
import { diffPlans, diffStats, summarizePlan, DiffRow, PlanStep } from "../lib/plan-diff";

interface Props {
  before: PlanNode;
  after: PlanNode;
  beforeLabel: string;
  afterLabel: string;
}

/** Side-by-side comparison of two EXPLAIN plans. */
export default function PlanDiffView({ before, after, beforeLabel, afterLabel }: Props) {
  const [onlyChanges, setOnlyChanges] = useState(false);
  const rows = useMemo(() => diffPlans(before, after), [before, after]);
  const stats = diffStats(rows);
  const sb = summarizePlan(before);
  const sa = summarizePlan(after);
  const visible = onlyChanges ? rows.filter((r) => r.kind !== "same") : rows;
  const identical = stats.added + stats.removed + stats.changed === 0;

  return (
    <div className="pd-root">
      <table className="pd-summary">
        <thead>
          <tr>
            <th />
            <th>{beforeLabel}</th>
            <th>{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          <SummaryRow label="Indexes" a={sb.indexes.join(", ") || "—"} b={sa.indexes.join(", ") || "—"} />
          <SummaryRow label="PrimaryScan" a={sb.primaryScan ? "yes ⚠" : "no"} b={sa.primaryScan ? "yes ⚠" : "no"} />
          <SummaryRow label="Fetch" a={String(sb.fetches)} b={String(sa.fetches)} />
          <SummaryRow label="Operators" a={String(sb.operators)} b={String(sa.operators)} />
        </tbody>
      </table>

      <div className="pd-toolbar">
        {identical ? (
          <span className="pd-identical">The plans are identical.</span>
        ) : (
          <span className="pd-stats">
            <span className="pd-chip pd-added">+{stats.added} added</span>
            <span className="pd-chip pd-removed">−{stats.removed} removed</span>
            <span className="pd-chip pd-changed">~{stats.changed} changed</span>
          </span>
        )}
        <label className="pd-only">
          <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
          Only differences
        </label>
      </div>

      <table className="pd-table" aria-label="Plan differences">
        <thead>
          <tr>
            <th>{beforeLabel}</th>
            <th>{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i} className={`pd-row pd-${r.kind}`}>
              <td>{r.left && <Step step={r.left} highlight={r.changedKeys} />}</td>
              <td>{r.right && <Step step={r.right} highlight={r.changedKeys} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className={a !== b ? "pd-summary-diff" : undefined}>
      <th>{label}</th>
      <td>{a}</td>
      <td>{b}</td>
    </tr>
  );
}

function Step({ step, highlight }: { step: PlanStep; highlight?: DiffRow["changedKeys"] }) {
  const entries = Object.entries(step.props).slice(0, 6);
  return (
    <div className="pd-step" style={{ paddingLeft: step.depth * 14 }}>
      <span className="pd-op">{step.op}</span>
      {entries.map(([k, v]) => (
        <span key={k} className={`pd-prop${highlight?.includes(k) ? " pd-prop-changed" : ""}`}>
          {k}={v}
        </span>
      ))}
    </div>
  );
}
