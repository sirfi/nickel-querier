import { useState, useMemo } from "react";
import { QueryResult } from "../lib/types";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import "./ResultViewer.css";

type ViewMode = "table" | "json" | "tree";
type SortDirection = "asc" | "desc";

interface Props {
  result: QueryResult | null;
  error: string | null;
  isLoading: boolean;
}

// ---------- Export helpers ----------

function exportJson(rows: unknown[]): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  triggerDownload(blob, "results.json");
}

function exportCsv(rows: Record<string, unknown>[], columns: string[]): void {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  triggerDownload(blob, "results.csv");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ResultViewer({ result, error, isLoading }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [page, setPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [filterText, setFilterText] = useState("");
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

  const allRows = result.results as Record<string, unknown>[];
  const columns = allRows.length > 0 ? Object.keys(allRows[0] ?? {}) : [];

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  const handleFilterChange = (v: string) => {
    setFilterText(v);
    setPage(0);
  };

  const processedRows = useMemo(() => {
    let rows = allRows;

    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((v) =>
          String(v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : v)
            .toLowerCase()
            .includes(lower)
        )
      );
    }

    if (sortColumn) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortColumn];
        const bv = b[sortColumn];
        const aStr = av === null || av === undefined ? "" : typeof av === "object" ? JSON.stringify(av) : String(av);
        const bStr = bv === null || bv === undefined ? "" : typeof bv === "object" ? JSON.stringify(bv) : String(bv);
        const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [allRows, filterText, sortColumn, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / PAGE_SIZE));
  const pageRows = processedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  const renderExportMenu = () => (
    <div className="rv-export">
      <button
        className="btn btn-ghost rv-export-btn"
        onClick={() => exportJson(allRows)}
        data-tooltip="Download as JSON"
      >
        ↓ JSON
      </button>
      <button
        className="btn btn-ghost rv-export-btn"
        onClick={() => exportCsv(allRows, columns)}
        data-tooltip="Download as CSV"
        disabled={columns.length === 0}
      >
        ↓ CSV
      </button>
    </div>
  );

  const renderTable = () => {
    if (allRows.length === 0) {
      return <div className="rv-no-rows">No rows returned.</div>;
    }
    if (columns.length === 0) {
      return (
        <div className="rv-json-container">
          <JsonView data={allRows} />
        </div>
      );
    }
    return (
      <div className="rv-table-wrapper">
        <div className="rv-filter-bar">
          <input
            className="input rv-filter-input"
            type="text"
            placeholder="Filter rows…"
            value={filterText}
            onChange={(e) => handleFilterChange(e.target.value)}
          />
          {filterText && (
            <span className="rv-filter-count">
              {processedRows.length} / {allRows.length}
            </span>
          )}
        </div>
        <table className="rv-table">
          <thead>
            <tr>
              <th className="rv-th rv-th-row">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`rv-th rv-th-sortable${sortColumn === col ? " rv-th-sorted" : ""}`}
                  onClick={() => handleSort(col)}
                >
                  {col}
                  <span className="rv-sort-icon">
                    {sortColumn === col ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                  </span>
                </th>
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
        {JSON.stringify(allRows, null, 2)}
      </pre>
    </div>
  );

  const renderTree = () => (
    <div className="rv-json-container rv-tree">
      <JsonView
        data={allRows}
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
        <div className="rv-header-right">
          {renderExportMenu()}
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
