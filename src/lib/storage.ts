// ============================================================
// Nickel Querier — Persistence (localStorage fallback for dev)
// ============================================================
import { HistoryEntry, SavedQuery, SavedConnection } from "./types";

const HISTORY_KEY = "nq_history";
const SAVED_KEY = "nq_saved";
const CONN_KEY = "nq_connection";
const CONNECTIONS_KEY = "nq_connections";
const LAST_CONN_ID_KEY = "nq_last_conn_id";
const THEME_KEY = "nq_theme";
const EDITOR_FONT_SIZE_KEY = "nq_editor_font_size";
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
