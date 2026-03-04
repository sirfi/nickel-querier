// ============================================================
// Nickel Querier — Storage unit tests
// ============================================================
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHistory,
  addHistory,
  clearHistory,
  deleteHistoryEntry,
  loadSavedQueries,
  addSavedQuery,
  deleteSavedQuery,
  updateSavedQuery,
  loadConnection,
  saveConnection,
} from "./storage";
import type { HistoryEntry, SavedQuery } from "./types";

beforeEach(() => {
  localStorage.clear();
});

// ---------- History ----------

describe("loadHistory", () => {
  it("returns an empty array when no history is stored", () => {
    expect(loadHistory()).toEqual([]);
  });
});

describe("addHistory", () => {
  it("prepends a new entry", () => {
    const entry: HistoryEntry = {
      id: "1",
      statement: "SELECT 1",
      executed_at: new Date().toISOString(),
      duration_ms: 10,
      row_count: 1,
      status: "success",
    };
    addHistory(entry);
    expect(loadHistory()[0]).toEqual(entry);
  });

  it("keeps newest entry first (prepend semantics)", () => {
    const first: HistoryEntry = {
      id: "a",
      statement: "SELECT 1",
      executed_at: new Date().toISOString(),
      duration_ms: 5,
      row_count: 1,
      status: "success",
    };
    const second: HistoryEntry = {
      id: "b",
      statement: "SELECT 2",
      executed_at: new Date().toISOString(),
      duration_ms: 8,
      row_count: 1,
      status: "success",
    };
    addHistory(first);
    addHistory(second);
    const history = loadHistory();
    expect(history[0].id).toBe("b");
    expect(history[1].id).toBe("a");
  });

  it("caps history at 200 entries", () => {
    for (let i = 0; i < 205; i++) {
      addHistory({
        id: String(i),
        statement: `SELECT ${i}`,
        executed_at: new Date().toISOString(),
        duration_ms: 1,
        row_count: 0,
        status: "success",
      });
    }
    expect(loadHistory().length).toBe(200);
  });
});

describe("clearHistory", () => {
  it("removes all entries", () => {
    addHistory({
      id: "x",
      statement: "SELECT 1",
      executed_at: new Date().toISOString(),
      duration_ms: 1,
      row_count: 0,
      status: "success",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("deleteHistoryEntry", () => {
  it("removes only the matching entry by id", () => {
    const a: HistoryEntry = {
      id: "del-a",
      statement: "SELECT 1",
      executed_at: new Date().toISOString(),
      duration_ms: 1,
      row_count: 0,
      status: "success",
    };
    const b: HistoryEntry = {
      id: "del-b",
      statement: "SELECT 2",
      executed_at: new Date().toISOString(),
      duration_ms: 1,
      row_count: 0,
      status: "success",
    };
    addHistory(a);
    addHistory(b);
    deleteHistoryEntry("del-a");
    const remaining = loadHistory();
    expect(remaining.find((e) => e.id === "del-a")).toBeUndefined();
    expect(remaining.find((e) => e.id === "del-b")).toBeDefined();
  });
});

// ---------- Saved Queries ----------

describe("loadSavedQueries", () => {
  it("returns an empty array when nothing is saved", () => {
    expect(loadSavedQueries()).toEqual([]);
  });
});

describe("addSavedQuery", () => {
  it("prepends the new query", () => {
    const q: SavedQuery = {
      id: "sq-1",
      name: "My Query",
      statement: "SELECT * FROM `travel-sample` LIMIT 10",
      created_at: new Date().toISOString(),
      tags: ["demo"],
    };
    addSavedQuery(q);
    expect(loadSavedQueries()[0]).toEqual(q);
  });
});

describe("deleteSavedQuery", () => {
  it("removes the query with the given id", () => {
    const q: SavedQuery = {
      id: "sq-del",
      name: "Delete Me",
      statement: "SELECT 1",
      created_at: new Date().toISOString(),
      tags: [],
    };
    addSavedQuery(q);
    deleteSavedQuery("sq-del");
    expect(loadSavedQueries().find((s) => s.id === "sq-del")).toBeUndefined();
  });
});

describe("updateSavedQuery", () => {
  it("replaces the query with the same id", () => {
    const original: SavedQuery = {
      id: "sq-upd",
      name: "Original",
      statement: "SELECT 1",
      created_at: new Date().toISOString(),
      tags: [],
    };
    addSavedQuery(original);
    const updated: SavedQuery = { ...original, name: "Updated" };
    updateSavedQuery(updated);
    const saved = loadSavedQueries();
    expect(saved.find((s) => s.id === "sq-upd")?.name).toBe("Updated");
  });
});

// ---------- Connection Config ----------

describe("loadConnection", () => {
  it("returns sensible defaults when nothing is stored", () => {
    const conn = loadConnection();
    expect(conn.host).toBe("localhost");
    expect(conn.port).toBe(8093);
    expect(conn.username).toBe("Administrator");
    expect(conn.tls).toBe(false);
  });
});

describe("saveConnection / loadConnection", () => {
  it("persists and retrieves connection details", () => {
    saveConnection({
      host: "cb.example.com",
      port: 18093,
      username: "dev",
      password: "s3cr3t",
      tls: true,
    });
    const conn = loadConnection();
    expect(conn.host).toBe("cb.example.com");
    expect(conn.port).toBe(18093);
    expect(conn.username).toBe("dev");
    expect(conn.tls).toBe(true);
  });
});
