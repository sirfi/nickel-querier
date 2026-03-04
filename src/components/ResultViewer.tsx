import { useState } from "react";
import { QueryResult } from "../lib/types";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import "./ResultViewer.css";

type ViewMode = "table" | "json" | "tree";

interface Props {
  result: QueryResult | null;
  error: string | null;
  isLoading: boolean;
}

export default function ResultViewer({ result, error, isLoading }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  if (isLoading) {
    return (
      <div className="rv-placeholder">
        <span className="rv-spinner" />
        <span>Executing query…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rv-error">
        <div className="rv-error-header">✕ Query Error</div>
        <pre className="rv-error-body">{error}</pre>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rv-placeholder">
        <span className="rv-empty-icon">⬡</span>
        <span>Run a query to see results</span>
      </div>
    );
  }

  const rows = result.results as Record<string, unknown>[];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const columns =
    rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

  const renderMetricsBar = () => (
    <div className="rv-metrics">
      <span className={`badge ${result.status === "success" ? "badge-success" : "badge-error"}`}>
        {result.status}
      </span>
      <span>{result.metrics.result_count.toLocaleString()} rows</span>
      <span>•</span>
      <span>⏱ {result.metrics.elapsed_time}</span>
      <span>•</span>
      <span>exec {result.metrics.execution_time}</span>
      {result.metrics.mutation_count > 0 && (
        <>
          <span>•</span>
          <span>{result.metrics.mutation_count} mutations</span>
        </>
      )}
      {result.warnings.length > 0 && (
        <>
          <span>•</span>
          <span className="badge badge-warning">{result.warnings.length} warnings</span>
        </>
      )}
    </div>
  );

  const renderTable = () => {
    if (rows.length === 0) {
      return <div className="rv-no-rows">No rows returned.</div>;
    }
    if (columns.length === 0) {
      return (
        <div className="rv-json-container">
          <JsonView data={rows} />
        </div>
      );
    }
    return (
      <div className="rv-table-wrapper">
        <table className="rv-table">
          <thead>
            <tr>
              <th className="rv-th rv-th-row">#</th>
              {columns.map((col) => (
                <th key={col} className="rv-th">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="rv-tr">
                <td className="rv-td rv-td-row">{page * PAGE_SIZE + i + 1}</td>
                {columns.map((col) => (
                  <td key={col} className="rv-td">
                    <CellValue value={row[col]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="rv-pagination">
            <button
              className="btn btn-ghost"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              ‹ Prev
            </button>
            <span>
              Page {page + 1} / {totalPages}
            </span>
            <button
              className="btn btn-ghost"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderJson = () => (
    <div className="rv-json-container">
      <pre className="rv-json-raw">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );

  const renderTree = () => (
    <div className="rv-json-container rv-tree">
      <JsonView
        data={rows}
        style={{
          container: "rv-json-view",
          basicChildStyle: "rv-json-child",
          label: "rv-json-label",
          clickableLabel: "rv-json-label-click",
          nullValue: "rv-json-null",
          undefinedValue: "rv-json-null",
          numberValue: "rv-json-number",
          stringValue: "rv-json-string",
          booleanValue: "rv-json-bool",
          otherValue: "rv-json-other",
          punctuation: "rv-json-punct",
          expandIcon: "rv-json-expand",
          collapseIcon: "rv-json-expand",
          collapsedContent: "rv-json-collapsed",
          noQuotesForStringValues: false,
        }}
      />
    </div>
  );

  return (
    <div className="rv-root">
      <div className="rv-header">
        {renderMetricsBar()}
        <div className="rv-view-toggle">
          {(["table", "json", "tree"] as ViewMode[]).map((m) => (
            <button
              key={m}
              className={`rv-tab ${viewMode === m ? "active" : ""}`}
              onClick={() => setViewMode(m)}
            >
              {m === "table" ? "⊞ Table" : m === "json" ? "{ } JSON" : "⊵ Tree"}
            </button>
          ))}
        </div>
      </div>
      <div className="rv-body">
        {viewMode === "table" && renderTable()}
        {viewMode === "json" && renderJson()}
        {viewMode === "tree" && renderTree()}
      </div>
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null) return <span className="cell-null">null</span>;
  if (value === undefined) return <span className="cell-null">MISSING</span>;
  if (typeof value === "boolean")
    return <span className="cell-bool">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="cell-number">{String(value)}</span>;
  if (typeof value === "string") return <span className="cell-string">{value}</span>;
  if (typeof value === "object")
    return (
      <span className="cell-object" title={JSON.stringify(value)}>
        {JSON.stringify(value).slice(0, 60)}…
      </span>
    );
  return <span>{String(value)}</span>;
}
