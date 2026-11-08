import { useState, useMemo, useEffect } from "react";
import { QueryResult } from "../lib/types";
import { JsonView } from "react-json-view-lite";
import {
  Row,
  SortDirection,
  toRows,
  collectColumns,
  filterRows,
  sortRows,
  toCsv,
  toTsv,
  truncate,
  RAW_VALUE_COLUMN,
} from "../lib/result-utils";
import { saveTextFile, timestampedName } from "../lib/export";
import "react-json-view-lite/dist/index.css";
import "./ResultViewer.css";

type ViewMode = "table" | "json" | "tree";

interface Props {
  result: QueryResult | null;
  error: string | null;
  isLoading: boolean;
  /** Extra line under the spinner (e.g. why a Stop request failed) */
  loadingNote?: string | null;
}

const PAGE_SIZE = 100;
const EMPTY_ROWS: Row[] = [];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ResultViewer({ result, error, isLoading, loadingNote }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [page, setPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [filterText, setFilterText] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  // All hooks must run on every render — keep them above the early returns.
  const allRows = useMemo(() => (result ? toRows(result.results) : EMPTY_ROWS), [result]);
  const columns = useMemo(() => collectColumns(allRows), [allRows]);

  const processedRows = useMemo(
    () => sortRows(filterRows(allRows, filterText), sortColumn, sortDir),
    [allRows, filterText, sortColumn, sortDir]
  );

  // A new result invalidates paging / sort / filter of the previous one.
  useEffect(() => {
    setPage(0);
    setFilterText("");
    setSortColumn(null);
    setSortDir("asc");
    setSelectedRow(null);
  }, [result]);

  if (isLoading) {
    return (
      <div className="rv-placeholder">
        <span className="rv-spinner" />
        <span>Executing query…</span>
        {loadingNote && <span className="rv-loading-note" role="status">{loadingNote}</span>}
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

  const rawResults = result.results;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleExport = async (kind: "json" | "csv") => {
    try {
      const path = await saveTextFile(
        kind === "json"
          ? {
              fileName: timestampedName("results", "json"),
              contents: JSON.stringify(rawResults, null, 2),
              mime: "application/json",
              filterName: "JSON",
              extensions: ["json"],
            }
          : {
              fileName: timestampedName("results", "csv"),
              contents: toCsv(processedRows, columns),
              mime: "text/csv",
              filterName: "CSV",
              extensions: ["csv"],
            }
      );
      if (path) flash(`Saved ${path}`);
    } catch (e) {
      flash(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const handleCopy = async (kind: "json" | "tsv") => {
    const text =
      kind === "json" ? JSON.stringify(rawResults, null, 2) : toTsv(processedRows, columns);
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    }
  };

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
          <span
            className="badge badge-warning"
            title={result.warnings
              .map((w) => (w as { msg?: string }).msg ?? JSON.stringify(w))
              .join("\n")}
          >
            {result.warnings.length} warnings
          </span>
        </>
      )}
    </div>
  );

  const renderExportMenu = () => (
    <div className="rv-export">
      {notice && <span className="rv-notice" title={notice}>{notice}</span>}
      <button
        className="btn btn-ghost rv-export-btn"
        onClick={() => handleExport("json")}
        data-tooltip="Download as JSON"
      >
        ↓ JSON
      </button>
      <button
        className="btn btn-ghost rv-export-btn"
        onClick={() => handleExport("csv")}
        data-tooltip="Download as CSV"
        disabled={columns.length === 0}
      >
        ↓ CSV
      </button>
      <button
        className="btn btn-ghost rv-export-btn"
        onClick={() => handleCopy("tsv")}
        data-tooltip="Copy visible rows (tab separated, paste into a spreadsheet)"
        disabled={columns.length === 0}
      >
        {copied === "tsv" ? "✓ Copied" : "⧉ Copy"}
      </button>
      <button
        className="btn btn-ghost rv-export-btn"
        onClick={() => handleCopy("json")}
        data-tooltip="Copy results as JSON"
      >
        {copied === "json" ? "✓ Copied" : "⧉ JSON"}
      </button>
    </div>
  );

  const renderTable = () => {
    if (allRows.length === 0) {
      return <div className="rv-no-rows">No rows returned.</div>;
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
              <tr
                key={i}
                className={`rv-tr${row === selectedRow ? " rv-tr-selected" : ""}`}
                onClick={() => setSelectedRow(row === selectedRow ? null : row)}
                title="Click to show the full row"
              >
                <td className="rv-td rv-td-row">
                  <button
                    className="rv-row-btn"
                    aria-label={`Show row ${page * PAGE_SIZE + i + 1}`}
                    aria-expanded={row === selectedRow}
                    onClick={(e) => {
                      e.stopPropagation(); // the row's own click handler would toggle again
                      setSelectedRow(row === selectedRow ? null : row);
                    }}
                  >
                    {page * PAGE_SIZE + i + 1}
                  </button>
                </td>
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
        {JSON.stringify(rawResults, null, 2)}
      </pre>
    </div>
  );

  const renderTree = () => (
    <div className="rv-json-container rv-tree">
      <JsonView
        data={rawResults}
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
        <div className="rv-main">
          {viewMode === "table" && renderTable()}
          {viewMode === "json" && renderJson()}
          {viewMode === "tree" && renderTree()}
        </div>
        {viewMode === "table" && selectedRow && (
          <RowDetail row={selectedRow} onClose={() => setSelectedRow(null)} />
        )}
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
      <span className="cell-object" title={JSON.stringify(value, null, 2)}>
        {truncate(JSON.stringify(value), 80)}
      </span>
    );
  return <span>{String(value)}</span>;
}

function RowDetail({ row, onClose }: { row: Row; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const value = Object.keys(row).length === 1 && RAW_VALUE_COLUMN in row ? row[RAW_VALUE_COLUMN] : row;
  const text = JSON.stringify(value, null, 2);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="rv-detail" aria-label="Row detail">
      <div className="rv-detail-head">
        <span>Row</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "✓ Copied" : "⧉ Copy"}
        </button>
        <button className="btn btn-ghost" onClick={onClose} aria-label="Close row detail">
          ✕
        </button>
      </div>
      <pre className="rv-detail-body">{text}</pre>
    </aside>
  );
}
