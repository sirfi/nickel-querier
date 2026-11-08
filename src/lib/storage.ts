// ============================================================
// Nickel Querier — Persistence (localStorage fallback for dev)
// ============================================================
import { HistoryEntry, SavedQuery, SavedConnection, QueryTab } from "./types";

const HISTORY_KEY = "nq_history";
const SAVED_KEY = "nq_saved";
const CONN_KEY = "nq_connection";
const CONNECTIONS_KEY = "nq_connections";
const LAST_CONN_ID_KEY = "nq_last_conn_id";
const THEME_KEY = "nq_theme";
const EDITOR_FONT_SIZE_KEY = "nq_editor_font_size";
const TABS_KEY = "nq_tabs";
const LAYOUT_KEY = "nq_layout";
const MAX_HISTORY = 200;

const EDITOR_FONT_SIZE_MIN = 10;
const EDITOR_FONT_SIZE_MAX = 28;
const EDITOR_FONT_SIZE_DEFAULT = 14;

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ---------- Query History ----------

export function loadHistory(): HistoryEntry[] {
  return load<HistoryEntry[]>(HISTORY_KEY) ?? [];
}

export function addHistory(entry: HistoryEntry): void {
  const history = loadHistory();
  history.unshift(entry);
  save(HISTORY_KEY, history.slice(0, MAX_HISTORY));
}

export function clearHistory(): void {
  save(HISTORY_KEY, []);
}

export function deleteHistoryEntry(id: string): void {
  const history = loadHistory().filter((e) => e.id !== id);
  save(HISTORY_KEY, history);
}

// ---------- Saved Queries ----------

export function loadSavedQueries(): SavedQuery[] {
  return load<SavedQuery[]>(SAVED_KEY) ?? [];
}

export function addSavedQuery(query: SavedQuery): void {
  const saved = loadSavedQueries();
  save(SAVED_KEY, [query, ...saved]);
}

export function deleteSavedQuery(id: string): void {
  const saved = loadSavedQueries().filter((q) => q.id !== id);
  save(SAVED_KEY, saved);
}

export function updateSavedQuery(updated: SavedQuery): void {
  const saved = loadSavedQueries().map((q) => (q.id === updated.id ? updated : q));
  save(SAVED_KEY, saved);
}

export const SAVED_QUERIES_EXPORT_FORMAT = "nickel-querier/saved-queries";

/** File contents for exporting saved queries. */
export function exportSavedQueries(queries: SavedQuery[]): string {
  return JSON.stringify({ format: SAVED_QUERIES_EXPORT_FORMAT, version: 1, queries }, null, 2);
}

function isSavedQuery(q: unknown): q is SavedQuery {
  if (!q || typeof q !== "object") return false;
  const o = q as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.statement === "string";
}

/**
 * Merge imported queries (an export file, or a plain array) into the saved
 * list. Entries with the same name and statement as an existing query are
 * skipped; others get a fresh id.
 */
export function importSavedQueries(json: string): { added: number; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("The file is not valid JSON");
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { queries?: unknown }).queries)
      ? (data as { queries: unknown[] }).queries
      : null;
  if (!list) throw new Error("No saved queries found in the file");

  const existing = loadSavedQueries();
  const seen = new Set(existing.map((q) => `${q.name}\u0000${q.statement}`));
  const added: SavedQuery[] = [];
  let skipped = 0;
  for (const raw of list) {
    if (!isSavedQuery(raw)) { skipped++; continue; }
    const key = `${raw.name}\u0000${raw.statement}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    added.push({
      id: crypto.randomUUID(),
      name: raw.name,
      statement: raw.statement,
      created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [],
    });
  }
  save(SAVED_KEY, [...added, ...existing]);
  return { added: added.length, skipped };
}

// ---------- Connection Config (legacy single-connection) ----------

export interface StoredConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

export function loadConnection(): StoredConnection {
  return (
    load<StoredConnection>(CONN_KEY) ?? {
      host: "localhost",
      port: 8093,
      username: "Administrator",
      password: "",
      tls: false,
    }
  );
}

export function saveConnection(conn: StoredConnection): void {
  save(CONN_KEY, conn);
}

// ---------- Named Connections ----------

const DEFAULT_CONNECTION: SavedConnection = {
  id: "default",
  name: "Default",
  host: "localhost",
  port: 8093,
  username: "Administrator",
  password: "",
  tls: false,
};

/**
 * Load all saved named connections. If none exist, migrates the legacy
 * single-connection config (if any) into a named "Default" connection.
 */
export function loadConnections(): SavedConnection[] {
  const stored = load<SavedConnection[]>(CONNECTIONS_KEY);
  if (stored && stored.length > 0) return stored;

  // Migrate legacy connection
  const legacy = load<StoredConnection>(CONN_KEY);
  if (legacy) {
    const migrated: SavedConnection = { id: "default", name: "Default", ...legacy };
    save(CONNECTIONS_KEY, [migrated]);
    return [migrated];
  }

  save(CONNECTIONS_KEY, [DEFAULT_CONNECTION]);
  return [DEFAULT_CONNECTION];
}

export function saveConnections(connections: SavedConnection[]): void {
  save(CONNECTIONS_KEY, connections);
}

export function addConnection(conn: SavedConnection): void {
  const connections = loadConnections();
  save(CONNECTIONS_KEY, [...connections, conn]);
}

export function deleteConnection(id: string): void {
  const connections = loadConnections().filter((c) => c.id !== id);
  save(CONNECTIONS_KEY, connections);
}

export function updateConnection(updated: SavedConnection): void {
  const connections = loadConnections().map((c) =>
    c.id === updated.id ? updated : c
  );
  save(CONNECTIONS_KEY, connections);
}

// ---------- Last Used Connection ID ----------

export function loadLastConnectionId(): string | null {
  return load<string>(LAST_CONN_ID_KEY);
}

export function saveLastConnectionId(id: string): void {
  save(LAST_CONN_ID_KEY, id);
}

// ---------- Open Tabs ----------

export interface StoredTabs {
  tabs: QueryTab[];
  activeTabId: string;
}

function isQueryTab(t: unknown): t is QueryTab {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.label === "string" &&
    typeof o.query === "string" && typeof o.connectionId === "string";
}

/** Restore open tabs. Returns null when nothing (valid) was stored. */
export function loadTabs(): StoredTabs | null {
  const stored = load<StoredTabs>(TABS_KEY);
  if (!stored || !Array.isArray(stored.tabs)) return null;
  const tabs = stored.tabs.filter(isQueryTab);
  if (tabs.length === 0) return null;
  const activeTabId = tabs.some((t) => t.id === stored.activeTabId)
    ? stored.activeTabId
    : tabs[0].id;
  return { tabs, activeTabId };
}

export function saveTabs(tabs: QueryTab[], activeTabId: string): void {
  save<StoredTabs>(TABS_KEY, {
    tabs: tabs.map(({ id, label, query, connectionId, paramValues, scanConsistency }) => ({
      id, label, query, connectionId, paramValues, scanConsistency,
    })),
    activeTabId,
  });
}

// ---------- Layout ----------

export interface Layout {
  /** Editor share of the editor+results height, 0.15 – 0.85 */
  editorRatio: number;
  /** Sidebar width in px */
  sidebarWidth: number;
}

export const DEFAULT_LAYOUT: Layout = { editorRatio: 0.5, sidebarWidth: 260 };
export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 600;

export function clampLayout(l: Partial<Layout>): Layout {
  const ratio = Number(l.editorRatio);
  const width = Number(l.sidebarWidth);
  return {
    editorRatio: Number.isFinite(ratio) ? Math.min(0.85, Math.max(0.15, ratio)) : DEFAULT_LAYOUT.editorRatio,
    sidebarWidth: Number.isFinite(width)
      ? Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)))
      : DEFAULT_LAYOUT.sidebarWidth,
  };
}

export function loadLayout(): Layout {
  return clampLayout(load<Partial<Layout>>(LAYOUT_KEY) ?? {});
}

export function saveLayout(layout: Layout): void {
  save(LAYOUT_KEY, clampLayout(layout));
}

// ---------- Theme ----------

export type AppTheme = "dark" | "light";

export function loadTheme(): AppTheme {
  return load<AppTheme>(THEME_KEY) ?? "dark";
}

export function saveTheme(theme: AppTheme): void {
  save(THEME_KEY, theme);
}

// ---------- Editor Font Size ----------

export function loadEditorFontSize(): number {
  return load<number>(EDITOR_FONT_SIZE_KEY) ?? EDITOR_FONT_SIZE_DEFAULT;
}

export function saveEditorFontSize(size: number): void {
  const clamped = Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, size));
  save(EDITOR_FONT_SIZE_KEY, clamped);
}

export { EDITOR_FONT_SIZE_MIN, EDITOR_FONT_SIZE_MAX, EDITOR_FONT_SIZE_DEFAULT };
