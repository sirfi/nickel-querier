// ============================================================
// Nickel Querier — Persistence (localStorage fallback for dev)
// ============================================================
import { HistoryEntry, SavedQuery } from "./types";

const HISTORY_KEY = "nq_history";
const SAVED_KEY = "nq_saved";
const CONN_KEY = "nq_connection";
const MAX_HISTORY = 200;

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

// ---------- Connection Config ----------

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
