import { useState } from "react";
import { SavedQuery } from "../lib/types";
import {
  addSavedQuery,
  deleteSavedQuery,
  updateSavedQuery,
} from "../lib/storage";
import { exportSavedQueries, importSavedQueries } from "../lib/storage";
import { saveTextFile, timestampedName } from "../lib/export";
import "./SavedQueries.css";

interface Props {
  queries: SavedQuery[];
  onSelect: (statement: string) => void;
  onRefresh: () => void;
  pendingStatement: string;
}

export default function SavedQueries({
  queries,
  onSelect,
  onRefresh,
  pendingStatement,
}: Props) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleExport = async () => {
    try {
      const path = await saveTextFile({
        fileName: timestampedName("saved-queries", "json"),
        contents: exportSavedQueries(queries),
        mime: "application/json",
        filterName: "JSON",
        extensions: ["json"],
      });
      if (path) flash(`Exported ${queries.length} queries`);
    } catch (e) {
      flash(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { added, skipped } = importSavedQueries(await file.text());
      onRefresh();
      flash(`Imported ${added}${skipped ? `, skipped ${skipped} duplicate/invalid` : ""}`);
    } catch (e) {
      flash(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const filtered = queries.filter(
    (q) =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.statement.toLowerCase().includes(search.toLowerCase()) ||
      q.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSaveNew = () => {
    if (!newName.trim()) return;
    addSavedQuery({
      id: crypto.randomUUID(),
      name: newName.trim(),
      statement: pendingStatement,
      created_at: new Date().toISOString(),
      tags: newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setNewName("");
    setNewTags("");
    setShowSaveForm(false);
    onRefresh();
  };

  const handleStartEdit = (q: SavedQuery) => {
    setEditingId(q.id);
    setEditName(q.name);
    setEditTags(q.tags.join(", "));
  };

  const handleSaveEdit = (q: SavedQuery) => {
    updateSavedQuery({
      ...q,
      name: editName.trim() || q.name,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setEditingId(null);
    onRefresh();
  };

  return (
    <div className="sq-root">
      <div className="sq-header">
        <input
          className="input sq-search"
          placeholder="Search saved queries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => setShowSaveForm(true)}
          disabled={!pendingStatement}
          data-tooltip="Save current query"
        >
          + Save
        </button>
      </div>
      <div className="sq-io">
        <button className="btn btn-ghost sq-btn" onClick={handleExport} disabled={queries.length === 0}>
          ↓ Export
        </button>
        <label className="btn btn-ghost sq-btn sq-import">
          ↑ Import
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Import saved queries"
            onChange={(e) => {
              handleImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {notice && <span className="sq-notice">{notice}</span>}
      </div>

      {showSaveForm && (
        <div className="sq-save-form">
          <input
            className="input"
            placeholder="Query name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            placeholder="Tags (comma separated)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />
          <div className="sq-form-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setShowSaveForm(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveNew}
              disabled={!newName.trim()}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="sq-empty">
          {queries.length === 0
            ? "No saved queries yet. Run a query then click Save."
            : "No results match your search."}
        </div>
      ) : (
        <ul className="sq-list">
          {filtered.map((q) => (
            <li key={q.id} className="sq-item">
              {editingId === q.id ? (
                <div className="sq-edit-form">
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="input"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="Tags (comma separated)"
                  />
                  <div className="sq-form-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSaveEdit(q)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="sq-name"
                    onClick={() => onSelect(q.statement)}
                    title={q.statement}
                  >
                    {q.name}
                  </div>
                  {q.tags.length > 0 && (
                    <div className="sq-tags">
                      {q.tags.map((t) => (
                        <span key={t} className="sq-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="sq-meta">
                    <span>{new Date(q.created_at).toLocaleDateString()}</span>
                    <div className="sq-actions">
                      <button
                        className="btn btn-ghost sq-btn"
                        onClick={() => handleStartEdit(q)}
                      >
                        ✎
                      </button>
                      <button
                        className="btn btn-ghost sq-btn"
                        onClick={() => {
                          deleteSavedQuery(q.id);
                          onRefresh();
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
