import { useState, useEffect, useCallback, useRef } from "react";
import ConnectionPanel from "./components/ConnectionPanel";
import QueryEditor from "./components/QueryEditor";
import QueryTabs from "./components/QueryTabs";
import ResultViewer from "./components/ResultViewer";
import QueryHistory from "./components/QueryHistory";
import SavedQueries from "./components/SavedQueries";
import SchemaExplorer from "./components/SchemaExplorer";
import ExplainViewer from "./components/ExplainViewer";

import { executeQuery, getExplainPlan } from "./lib/commands";
import {
  loadHistory,
  addHistory,
  loadSavedQueries,
  loadConnections,
  saveLastConnectionId,
  loadLastConnectionId,
  loadTheme,
  saveTheme,
  type AppTheme,
} from "./lib/storage";

import {
  ConnectionConfig,
  QueryResult,
  HistoryEntry,
  SavedQuery,
  SchemaField,
  SavedConnection,
  QueryTab,
} from "./lib/types";

import "./styles/App.css";

type SideTab = "schema" | "history" | "saved";
type ResultTab = "results" | "explain";

const DEFAULT_QUERY = `-- Welcome to Nickel Querier ⬡  SQL+++ for Couchbase
-- Press Ctrl+Enter (or ⌘+Enter) to run · Ctrl+Shift+E for EXPLAIN

SELECT "Hello from Nickel Querier!" AS greeting,
       NOW_STR() AS ts;
`;

let tabCounter = 1;

function makeTab(connectionId: string, query = DEFAULT_QUERY): QueryTab {
  return {
    id: crypto.randomUUID(),
    label: `Query ${tabCounter++}`,
    query,
    connectionId,
  };
}

// Per-tab result state (kept outside component to avoid bloating QueryTab type)
interface TabState {
  result: QueryResult | null;
  queryError: string | null;
  isRunning: boolean;
  explainPlan: unknown;
  isExplaining: boolean;
  resultTab: ResultTab;
  schemaFields: SchemaField[];
}

function emptyTabState(): TabState {
  return {
    result: null,
    queryError: null,
    isRunning: false,
    explainPlan: null,
    isExplaining: false,
    resultTab: "results",
    schemaFields: [],
  };
}

function getInitialConnectionId(): string {
  const lastId = loadLastConnectionId();
  const conns = loadConnections();
  if (lastId && conns.find((c) => c.id === lastId)) return lastId;
  return conns[0]?.id ?? "default";
}

export default function App() {
  // ---------- Theme ----------
  const [theme, setTheme] = useState<AppTheme>(() => loadTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme((prev) => {
      const next: AppTheme = prev === "dark" ? "light" : "dark";
      saveTheme(next);
      return next;
    });
  };

  // ---------- Connections ----------
  const [connections, setConnections] = useState<SavedConnection[]>(() =>
    loadConnections()
  );

  // ---------- Tabs ----------
  // Compute the initial tab once so all three state initialisers share the same id.
  const [initialTab] = useState<QueryTab>(() => makeTab(getInitialConnectionId()));
  const [tabs, setTabs] = useState<QueryTab[]>(() => [initialTab]);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialTab.id);

  // Per-tab state map
  const [tabStates, setTabStates] = useState<Record<string, TabState>>(() => ({
    [initialTab.id]: emptyTabState(),
  }));

  // Side panel
  const [sideTab, setSideTab] = useState<SideTab>("schema");
  const [sideOpen, setSideOpen] = useState(true);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  const editorRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setSavedQueries(loadSavedQueries());
  }, []);

  // ---------- Helpers ----------
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeState = tabStates[activeTabId] ?? emptyTabState();

  const activeConnection: ConnectionConfig = (() => {
    const conn = connections.find((c) => c.id === activeTab.connectionId);
    if (conn) return conn;
    return connections[0] ?? {
      host: "localhost",
      port: 8093,
      username: "Administrator",
      password: "",
      tls: false,
    };
  })();

  const updateActiveTab = (patch: Partial<QueryTab>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t))
    );
  };

  const updateTabState = (tabId: string, patch: Partial<TabState>) => {
    setTabStates((prev) => ({
      ...prev,
      [tabId]: { ...(prev[tabId] ?? emptyTabState()), ...patch },
    }));
  };

  // ---------- Tab management ----------
  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
  };

  const handleAddTab = () => {
    // New tab inherits the last active connection
    const connId = activeTab.connectionId;
    saveLastConnectionId(connId);
    const newTab = makeTab(connId);
    setTabs((prev) => [...prev, newTab]);
    setTabStates((prev) => ({ ...prev, [newTab.id]: emptyTabState() }));
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id: string) => {
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) return prev; // shouldn't happen
      if (activeTabId === id) {
        // Activate a neighbour
        const idx = prev.findIndex((t) => t.id === id);
        const next = remaining[Math.min(idx, remaining.length - 1)];
        setActiveTabId(next.id);
      }
      return remaining;
    });
    setTabStates((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const handleTabConnectionChange = (tabId: string, connectionId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, connectionId } : t))
    );
    saveLastConnectionId(connectionId);
  };

  // ---------- Query execution ----------
  const getActiveStatement = useCallback((): string => {
    const el = editorRootRef.current;
    if (el) {
      const fn = (el as HTMLElement & { getActiveStatement?: () => string })
        .getActiveStatement;
      if (fn) return fn();
    }
    return activeTab.query;
  }, [activeTab.query]);

  const handleRun = useCallback(async () => {
    const stmt = getActiveStatement().trim();
    if (!stmt) return;
    const tabId = activeTabId;

    updateTabState(tabId, {
      isRunning: true,
      queryError: null,
      result: null,
      resultTab: "results",
    });

    const start = Date.now();
    try {
      const res = await executeQuery(activeConnection, {
        statement: stmt,
        timeout: "60s",
        scan_consistency: "not_bounded",
      });
      updateTabState(tabId, { result: res, isRunning: false });
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        statement: stmt,
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        row_count: res.metrics.result_count,
        status: "success",
      };
      addHistory(entry);
      setHistory(loadHistory());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateTabState(tabId, { queryError: msg, isRunning: false });
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        statement: stmt,
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        row_count: 0,
        status: "error",
        error: msg,
      };
      addHistory(entry);
      setHistory(loadHistory());
    }
  }, [activeConnection, activeTabId, getActiveStatement]);

  const handleExplain = useCallback(async () => {
    const stmt = getActiveStatement().trim();
    if (!stmt) return;
    const tabId = activeTabId;

    updateTabState(tabId, {
      isExplaining: true,
      explainPlan: null,
      resultTab: "explain",
    });

    try {
      const plan = await getExplainPlan(activeConnection, stmt);
      updateTabState(tabId, { explainPlan: plan, isExplaining: false });
    } catch (e: unknown) {
      updateTabState(tabId, {
        explainPlan: { error: e instanceof Error ? e.message : String(e) },
        isExplaining: false,
      });
    }
  }, [activeConnection, activeTabId, getActiveStatement]);

  const handleSaveQuery = () => {
    setSideTab("saved");
    setSideOpen(true);
  };

  const handleHistorySelect = (stmt: string) => {
    updateActiveTab({ query: stmt });
  };

  const handleSavedSelect = (stmt: string) => {
    updateActiveTab({ query: stmt });
  };

  // ---------- Connection management ----------
  const handleConnectionsChange = (updated: SavedConnection[]) => {
    setConnections(updated);
  };

  const handleConnectionSelect = (id: string) => {
    // Update the active tab's connection
    handleTabConnectionChange(activeTabId, id);
  };

  return (
    <div className="app">
      {/* Top bar */}
      <header className="app-topbar">
        <div className="app-brand">
          <span className="app-brand-icon">⬡</span>
          <span className="app-brand-name">Nickel Querier</span>
          <span className="app-brand-tagline">SQL+++</span>
        </div>
        <ConnectionPanel
          connections={connections}
          selectedId={activeTab.connectionId}
          onSelect={handleConnectionSelect}
          onConnectionsChange={handleConnectionsChange}
        />
        <button
          className="btn btn-ghost app-theme-toggle"
          onClick={handleThemeToggle}
          data-tooltip={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button
          className="btn btn-ghost app-side-toggle"
          onClick={() => setSideOpen((v) => !v)}
          data-tooltip={sideOpen ? "Hide panel" : "Show panel"}
        >
          {sideOpen ? "◂" : "▸"}
        </button>
      </header>

      <div className="app-body">
        {/* Side panel */}
        {sideOpen && (
          <aside className="app-sidebar">
            <div className="sidebar-tabs">
              {(["schema", "history", "saved"] as SideTab[]).map((t) => (
                <button
                  key={t}
                  className={`sidebar-tab ${sideTab === t ? "active" : ""}`}
                  onClick={() => setSideTab(t)}
                >
                  {t === "schema"
                    ? "⊡ Schema"
                    : t === "history"
                    ? "⌚ History"
                    : "✦ Saved"}
                </button>
              ))}
            </div>
            <div className="sidebar-content">
              {sideTab === "schema" && (
                <SchemaExplorer
                  config={activeConnection}
                  onFieldsChange={(fields) =>
                    updateTabState(activeTabId, { schemaFields: fields })
                  }
                  onKeyspaceSelect={(ks) => {
                    updateActiveTab({ query: `SELECT * FROM \`${ks}\` LIMIT 10;` });
                  }}
                />
              )}
              {sideTab === "history" && (
                <QueryHistory
                  entries={history}
                  onSelect={handleHistorySelect}
                  onRefresh={() => setHistory(loadHistory())}
                />
              )}
              {sideTab === "saved" && (
                <SavedQueries
                  queries={savedQueries}
                  onSelect={handleSavedSelect}
                  onRefresh={() => setSavedQueries(loadSavedQueries())}
                  pendingStatement={activeTab.query}
                />
              )}
            </div>
          </aside>
        )}

        {/* Main content: tabs + editor + results */}
        <main className="app-main">
          {/* Query tabs bar */}
          <QueryTabs
            tabs={tabs}
            activeId={activeTabId}
            connections={connections}
            onSelect={handleSelectTab}
            onClose={handleCloseTab}
            onAdd={handleAddTab}
            onConnectionChange={handleTabConnectionChange}
          />

          {/* Editor pane */}
          <div className="app-editor-pane" ref={editorRootRef}>
            <QueryEditor
              key={activeTabId}
              value={activeTab.query}
              onChange={(q) => updateActiveTab({ query: q })}
              onRun={handleRun}
              onExplain={handleExplain}
              onSave={handleSaveQuery}
              isRunning={activeState.isRunning || activeState.isExplaining}
              schemaFields={activeState.schemaFields}
              monacoTheme={theme === "light" ? "nickel-light" : "nickel-dark"}
            />
          </div>

          {/* Resize handle */}
          <div className="app-resize-handle" />

          {/* Result pane */}
          <div className="app-result-pane">
            <div className="result-tabs">
              <button
                className={`result-tab ${activeState.resultTab === "results" ? "active" : ""}`}
                onClick={() =>
                  updateTabState(activeTabId, { resultTab: "results" })
                }
              >
                ⊞ Results
                {activeState.result && (
                  <span className="result-tab-count">
                    {activeState.result.metrics.result_count}
                  </span>
                )}
              </button>
              <button
                className={`result-tab ${activeState.resultTab === "explain" ? "active" : ""}`}
                onClick={() =>
                  updateTabState(activeTabId, { resultTab: "explain" })
                }
              >
                ⚡ Explain
              </button>
            </div>
            <div className="result-body">
              {activeState.resultTab === "results" && (
                <ResultViewer
                  result={activeState.result}
                  error={activeState.queryError}
                  isLoading={activeState.isRunning}
                />
              )}
              {activeState.resultTab === "explain" && (
                <ExplainViewer
                  plan={activeState.isExplaining ? null : activeState.explainPlan}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
