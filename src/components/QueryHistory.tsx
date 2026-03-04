import { useState } from "react";
import { HistoryEntry } from "../lib/types";
import { clearHistory, deleteHistoryEntry } from "../lib/storage";
import "./QueryHistory.css";

interface Props {
  entries: HistoryEntry[];
  onSelect: (statement: string) => void;
  onRefresh: () => void;
}

export default function QueryHistory({ entries, onSelect, onRefresh }: Props) {
  const [search, setSearch] = useState("");

  const filtered = entries.filter(
    (e) =>
      e.statement.toLowerCase().includes(search.toLowerCase()) ||
      (e.error ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleClearAll = () => {
    clearHistory();
    onRefresh();
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    onRefresh();
  };

  return (
    <div className="qh-root">
      <div className="qh-header">
        <input
          className="input qh-search"
          placeholder="Search history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn btn-ghost"
          onClick={handleClearAll}
          disabled={entries.length === 0}
          data-tooltip="Clear all history"
        >
          ✕ Clear
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="qh-empty">
          {entries.length === 0
            ? "No query history yet."
            : "No results match your search."}
        </div>
      ) : (
        <ul className="qh-list">
          {filtered.map((entry) => (
            <li key={entry.id} className="qh-item">
              <div
                className="qh-stmt"
                onClick={() => onSelect(entry.statement)}
                title={entry.statement}
              >
                {entry.statement.slice(0, 120)}
                {entry.statement.length > 120 ? "…" : ""}
              </div>
              <div className="qh-meta">
                <span
                  className={`badge ${
                    entry.status === "success" ? "badge-success" : "badge-error"
                  }`}
                >
                  {entry.status}
                </span>
                <span>{formatRelativeTime(entry.executed_at)}</span>
                {entry.row_count > 0 && (
                  <span>{entry.row_count.toLocaleString()} rows</span>
                )}
                {entry.duration_ms > 0 && (
                  <span>{entry.duration_ms}ms</span>
                )}
                <button
                  className="btn btn-ghost qh-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(entry.id);
                  }}
                >
                  ✕
                </button>
              </div>
              {entry.error && (
                <div className="qh-error">{entry.error}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}
