import { useState, useMemo } from "react";
import { SavedQuery } from "../lib/types";
import {
  addSavedQuery,
  deleteSavedQuery,
  updateSavedQuery,
  exportSavedQueries,
  importSavedQueries,
  loadSavedFolders,
  addSavedFolder,
  renameSavedFolder,
  deleteSavedFolder,
  moveSavedQuery,
} from "../lib/storage";
import {
  FolderNode,
  buildFolderTree,
  allFolderPaths,
  tagCounts,
  normalizeFolder,
  folderName,
  parentFolder,
  isInFolder,
} from "../lib/folders";
import { saveTextFile, timestampedName } from "../lib/export";
import { encodeShareLink, decodeShareLink, SharedQuery } from "../lib/share";
import "./SavedQueries.css";

interface Props {
  queries: SavedQuery[];
  onSelect: (statement: string) => void;
  onRefresh: () => void;
  pendingStatement: string;
  /** Open a query received as a share link (e.g. in a new tab) */
  onOpenShared?: (query: SharedQuery) => void;
}

const DRAG_QUERY = "application/x-nickel-query";
const DRAG_FOLDER = "application/x-nickel-folder";

const splitTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);

export default function SavedQueries({ queries, onSelect, onRefresh, pendingStatement, onOpenShared }: Props) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>(() => loadSavedFolders());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editFolder, setEditFolder] = useState("");

  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newFolder, setNewFolder] = useState("");

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const tree = useMemo(() => buildFolderTree(queries, folders), [queries, folders]);
  const folderPaths = useMemo(() => allFolderPaths(tree), [tree]);
  const tags = useMemo(() => tagCounts(queries), [queries]);

  const refreshAll = () => {
    setFolders(loadSavedFolders());
    onRefresh();
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // ---------- Import / export ----------
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
      refreshAll();
      flash(`Imported ${added}${skipped ? `, skipped ${skipped} duplicate/invalid` : ""}`);
    } catch (e) {
      flash(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ---------- Sharing ----------
  const handleCopyLink = async (q: SavedQuery) => {
    const link = encodeShareLink({ name: q.name, statement: q.statement, tags: q.tags });
    try {
      await navigator.clipboard.writeText(link);
      flash(`Link for "${q.name}" copied`);
    } catch {
      window.prompt("Copy this link:", link);
    }
  };

  const handleOpenLink = () => {
    const input = window.prompt("Paste a nickelquerier:// link:");
    if (!input) return;
    try {
      const shared = decodeShareLink(input);
      onOpenShared?.(shared);
      flash(`Opened "${shared.name}" in a new tab — use + Save to keep it`);
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  };

  // ---------- Queries ----------
  const handleSaveNew = () => {
    if (!newName.trim()) return;
    addSavedQuery({
      id: crypto.randomUUID(),
      name: newName.trim(),
      statement: pendingStatement,
      created_at: new Date().toISOString(),
      tags: splitTags(newTags),
      folder: normalizeFolder(newFolder),
    });
    setNewName("");
    setNewTags("");
    setShowSaveForm(false);
    refreshAll();
  };

  const handleStartEdit = (q: SavedQuery) => {
    setEditingId(q.id);
    setEditName(q.name);
    setEditTags(q.tags.join(", "));
    setEditFolder(normalizeFolder(q.folder));
  };

  const handleSaveEdit = (q: SavedQuery) => {
    updateSavedQuery({
      ...q,
      name: editName.trim() || q.name,
      tags: splitTags(editTags),
      folder: normalizeFolder(editFolder),
    });
    setEditingId(null);
    refreshAll();
  };

  // ---------- Folders ----------
  const handleNewFolder = (parent = "") => {
    const name = window.prompt(parent ? `New folder inside "${parent}":` : "New folder name:");
    if (!name?.trim()) return;
    const path = addSavedFolder(parent ? `${parent}/${name}` : name);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(parent);
      return next;
    });
    setFolders(loadSavedFolders());
    flash(`Created folder ${path}`);
  };

  const commitRename = (from: string) => {
    const to = normalizeFolder(parentFolder(from) ? `${parentFolder(from)}/${renameValue}` : renameValue);
    setRenaming(null);
    if (!to || to === from) return;
    renameSavedFolder(from, to);
    refreshAll();
  };

  const handleDeleteFolder = (node: FolderNode) => {
    const where = parentFolder(node.path) || "the top level";
    if (node.total > 0 && !window.confirm(
      `Delete folder "${node.path}"? Its ${node.total} queries move to ${where}.`
    )) return;
    deleteSavedFolder(node.path);
    refreshAll();
  };

  // ---------- Drag & drop ----------
  const onDragOverFolder = (e: React.DragEvent, path: string) => {
    const types = e.dataTransfer.types;
    if (!types.includes(DRAG_QUERY) && !types.includes(DRAG_FOLDER)) return;
    e.preventDefault();
    e.stopPropagation(); // the root list is a drop target too
    e.dataTransfer.dropEffect = "move";
    setDropTarget(path);
  };

  const onDropFolder = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation(); // otherwise the root list would move it again
    setDropTarget(null);
    const queryId = e.dataTransfer.getData(DRAG_QUERY);
    const folder = e.dataTransfer.getData(DRAG_FOLDER);
    if (queryId) {
      moveSavedQuery(queryId, path);
      refreshAll();
    } else if (folder && !isInFolder(path, folder)) {
      // move the folder (with contents) into the target
      renameSavedFolder(folder, path ? `${path}/${folderName(folder)}` : folderName(folder));
      refreshAll();
    }
  };

  const toggleFolder = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  // ---------- Filtering ----------
  const needle = search.trim().toLowerCase();
  const filtering = needle !== "" || activeTag !== null;
  const filtered = queries
    .filter((q) => !activeTag || q.tags.includes(activeTag))
    .filter(
      (q) =>
        !needle ||
        q.name.toLowerCase().includes(needle) ||
        q.statement.toLowerCase().includes(needle) ||
        normalizeFolder(q.folder).toLowerCase().includes(needle) ||
        q.tags.some((t) => t.toLowerCase().includes(needle))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---------- Rendering ----------
  const renderQuery = (q: SavedQuery, showFolder: boolean) => (
    <li
      key={q.id}
      className="sq-item"
      draggable={editingId !== q.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_QUERY, q.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      {editingId === q.id ? (
        <div className="sq-edit-form">
          <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus aria-label="Name" />
          <input
            className="input"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="Tags (comma separated)"
            aria-label="Tags"
          />
          <input
            className="input"
            value={editFolder}
            onChange={(e) => setEditFolder(e.target.value)}
            placeholder="Folder (e.g. Reports/Daily)"
            list="sq-folder-list"
            aria-label="Folder"
          />
          <div className="sq-form-actions">
            <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => handleSaveEdit(q)}>Save</button>
          </div>
        </div>
      ) : (
        <>
          <button className="sq-name" onClick={() => onSelect(q.statement)} title={q.statement}>
            {q.name}
          </button>
          {showFolder && q.folder && <div className="sq-folder-label">📁 {normalizeFolder(q.folder)}</div>}
          {q.tags.length > 0 && (
            <div className="sq-tags">
              {q.tags.map((t) => (
                <button
                  key={t}
                  className={`sq-tag${activeTag === t ? " active" : ""}`}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                  title={`Filter by tag "${t}"`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="sq-meta">
            <span>{new Date(q.created_at).toLocaleDateString()}</span>
            <div className="sq-actions">
              <button
                className="btn btn-ghost sq-btn"
                onClick={() => handleCopyLink(q)}
                aria-label={`Copy share link for ${q.name}`}
                data-tooltip="Copy share link"
              >
                🔗
              </button>
              <button className="btn btn-ghost sq-btn" onClick={() => handleStartEdit(q)} aria-label={`Edit ${q.name}`}>
                ✎
              </button>
              <button
                className="btn btn-ghost sq-btn"
                onClick={() => {
                  deleteSavedQuery(q.id);
                  refreshAll();
                }}
                aria-label={`Delete ${q.name}`}
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}
    </li>
  );

  const renderFolder = (node: FolderNode): React.ReactNode => {
    const open = !collapsed.has(node.path);
    return (
      <li key={node.path} className="sq-folder">
        <div
          className={`sq-folder-head${dropTarget === node.path ? " drop" : ""}`}
          draggable={renaming !== node.path}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData(DRAG_FOLDER, node.path);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => onDragOverFolder(e, node.path)}
          onDragLeave={() => setDropTarget((t) => (t === node.path ? null : t))}
          onDrop={(e) => onDropFolder(e, node.path)}
        >
          {renaming === node.path ? (
            <input
              className="input sq-rename"
              value={renameValue}
              autoFocus
              aria-label="Folder name"
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(node.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(node.path);
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <button
              className="sq-folder-toggle"
              onClick={() => toggleFolder(node.path)}
              aria-expanded={open}
            >
              <span className="sq-chevron">{open ? "▾" : "▸"}</span> 📁 {node.name}
              <span className="sq-count">{node.total}</span>
            </button>
          )}
          <span className="sq-actions">
            <button className="btn btn-ghost sq-btn" onClick={() => handleNewFolder(node.path)} aria-label={`New folder in ${node.path}`}>
              ＋
            </button>
            <button
              className="btn btn-ghost sq-btn"
              onClick={() => {
                setRenaming(node.path);
                setRenameValue(node.name);
              }}
              aria-label={`Rename ${node.path}`}
            >
              ✎
            </button>
            <button className="btn btn-ghost sq-btn" onClick={() => handleDeleteFolder(node)} aria-label={`Delete folder ${node.path}`}>
              ✕
            </button>
          </span>
        </div>
        {open && (
          <ul className="sq-children">
            {node.folders.map(renderFolder)}
            {node.queries.map((q) => renderQuery(q, false))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="sq-root">
      <datalist id="sq-folder-list">
        {folderPaths.map((p) => <option key={p} value={p} />)}
      </datalist>

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
        <button className="btn btn-ghost sq-btn" onClick={() => handleNewFolder()}>＋ Folder</button>
        {onOpenShared && (
          <button className="btn btn-ghost sq-btn" onClick={handleOpenLink} data-tooltip="Open a shared query link">
            🔗 Open link
          </button>
        )}
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

      {tags.length > 0 && (
        <div className="sq-tagbar" aria-label="Filter by tag">
          {tags.map(([t, n]) => (
            <button
              key={t}
              className={`sq-tag${activeTag === t ? " active" : ""}`}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              aria-pressed={activeTag === t}
            >
              {t} <span className="sq-tag-count">{n}</span>
            </button>
          ))}
        </div>
      )}

      {showSaveForm && (
        <div className="sq-save-form">
          <input className="input" placeholder="Query name…" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <input className="input" placeholder="Tags (comma separated)" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
          <input
            className="input"
            placeholder="Folder (optional, e.g. Reports/Daily)"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            list="sq-folder-list"
          />
          <div className="sq-form-actions">
            <button className="btn btn-ghost" onClick={() => setShowSaveForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveNew} disabled={!newName.trim()}>Save</button>
          </div>
        </div>
      )}

      {queries.length === 0 && folders.length === 0 ? (
        <div className="sq-empty">No saved queries yet. Run a query then click Save.</div>
      ) : filtering ? (
        filtered.length === 0 ? (
          <div className="sq-empty">No results match your search.</div>
        ) : (
          <ul className="sq-list">{filtered.map((q) => renderQuery(q, true))}</ul>
        )
      ) : (
        <ul
          className={`sq-list${dropTarget === "" ? " drop" : ""}`}
          onDragOver={(e) => onDragOverFolder(e, "")}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropTarget((t) => (t === "" ? null : t));
          }}
          onDrop={(e) => onDropFolder(e, "")}
          aria-label="Saved queries"
        >
          {tree.folders.map(renderFolder)}
          {tree.queries.map((q) => renderQuery(q, false))}
        </ul>
      )}
    </div>
  );
}
