import { useState, useEffect, useCallback, useRef } from "react";
import ConnectionPanel from "./components/ConnectionPanel";
import QueryEditor from "./components/QueryEditor";
import QueryTabs from "./components/QueryTabs";
import ResultViewer from "./components/ResultViewer";
import QueryHistory from "./components/QueryHistory";
import SavedQueries from "./components/SavedQueries";
import SchemaExplorer from "./components/SchemaExplorer";
import ExplainViewer from "./components/ExplainViewer";
import ParamsPanel from "./components/ParamsPanel";
import ResizeHandle from "./components/ResizeHandle";
import AdviseViewer from "./components/AdviseViewer";
import ShortcutsHelp, { isHelpShortcut } from "./components/ShortcutsHelp";
import { adviseStatement, parseAdvice, type Advice } from "./lib/indexes";
import { buildParams } from "./lib/params";
import { migrateConnectionSecrets } from "./lib/secrets";

import { executeQuery, getExplainPlan, cancelQuery } from "./lib/commands";
import {
  loadHistory,
  addHistory,
  loadSavedQueries,
  loadConnections,
  saveConnections,
  saveLastConnectionId,
  loadLastConnectionId,
  loadTheme,
  saveTheme,
  loadTabs,
  saveTabs,
  loadLayout,
  saveLayout,
  clampLayout,
  DEFAULT_LAYOUT,
  type Layout,
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
type ResultTab = "results" | "explain" | "advise";

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
  /** client_context_id of the running query (for cancellation) */
  runningContextId: string | null;
  cancelRequested: boolean;
  explainPlan: unknown;
  explainError: string | null;
  isExplaining: boolean;
  advice: Advice | null;
  adviseError: string | null;
  isAdvising: boolean;
  resultTab: ResultTab;
  schemaFields: SchemaField[];
}

function emptyTabState(): TabState {
  return {
    result: null,
    queryError: null,
    isRunning: false,
    runningContextId: null,
    cancelRequested: false,
    explainPlan: null,
    explainError: null,
    isExplaining: false,
    advice: null,
    adviseError: null,
    isAdvising: false,
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

function restoreTabs(connections: SavedConnection[]): { tabs: QueryTab[]; activeTabId: string } {
  const stored = loadTabs();
  if (stored) {
    const fallback = getInitialConnectionId();
    const tabs = stored.tabs.map((t) =>
      connections.some((c) => c.id === t.connectionId) ? t : { ...t, connectionId: fallback }
    );
    // Continue numbering after the highest "Query N" label.
    const maxN = Math.max(0, ...tabs.map((t) => Number(/^Query (\d+)$/.exec(t.label)?.[1] ?? 0)));
    tabCounter = Math.max(tabCounter, maxN + 1);
    return { tabs, activeTabId: stored.activeTabId };
  }
  const first = makeTab(getInitialConnectionId());
  return { tabs: [first], activeTabId: first.id };
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

  // Move plain-text passwords from older versions into the OS keychain.
  useEffect(() => {
    let cancelled = false;
    migrateConnectionSecrets(loadConnections()).then(({ connections: migrated, changed }) => {
      if (cancelled || !changed) return;
      saveConnections(migrated);
      setConnections(migrated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Tabs ----------
  // Restore the previous session's tabs (or create a first tab) exactly once.
  const [initial] = useState(() => restoreTabs(loadConnections()));
  const [tabs, setTabs] = useState<QueryTab[]>(() => initial.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => initial.activeTabId);

  // Per-tab state map
  const [tabStates, setTabStates] = useState<Record<string, TabState>>(() =>
    Object.fromEntries(initial.tabs.map((t) => [t.id, emptyTabState()]))
  );

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Persist open tabs (debounced, so typing does not hit storage every key).
  useEffect(() => {
    const handle = setTimeout(() => saveTabs(tabs, activeTabId), 400);
    return () => clearTimeout(handle);
  }, [tabs, activeTabId]);
  useEffect(() => {
    const flush = () => saveTabs(tabsRef.current, activeTabIdRef.current);
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  // ---------- Layout (resizable panes) ----------
  const [layout, setLayoutState] = useState<Layout>(() => loadLayout());
  const setLayout = (patch: Partial<Layout>) =>
    setLayoutState((prev) => {
      const next = clampLayout({ ...prev, ...patch });
      saveLayout(next);
      return next;
    });
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const resultPaneRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const dragEditorSplit = (clientY: number) => {
    const top = editorPaneRef.current?.getBoundingClientRect().top;
    const bottom = resultPaneRef.current?.getBoundingClientRect().bottom;
    if (top === undefined || bottom === undefined || bottom <= top) return;
    setLayout({ editorRatio: (clientY - top) / (bottom - top) });
  };
  const dragSidebar = (clientX: number) => {
    const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
    setLayout({ sidebarWidth: clientX - left });
  };

  // Side panel
  const [sideTab, setSideTab] = useState<SideTab>("schema");
  const [sideOpen, setSideOpen] = useState(true);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [keyspaces, setKeyspaces] = useState<string[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isHelpShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        setShowShortcuts((v) => !v);
      }
    };
    // Capture phase, so the editor does not swallow the shortcut
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

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

  const handleAddTab = (query?: string) => {
    // New tab inherits the last active connection
    const connId = activeTab.connectionId;
    saveLastConnectionId(connId);
    const newTab = makeTab(connId, query ?? "");
    setTabs((prev) => [...prev, newTab]);
    setTabStates((prev) => ({ ...prev, [newTab.id]: emptyTabState() }));
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    if (activeTabId === id) {
      // Activate a neighbour
      setActiveTabId(remaining[Math.min(idx, remaining.length - 1)].id);
    }
    setTabs(remaining);
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
  const handleRun = useCallback(async (statement: string) => {
    const stmt = statement.trim();
    if (!stmt) return;
    const tabId = activeTabId;

    const params = buildParams(stmt, activeTab.paramValues ?? {});
    if (!params.ok) {
      updateTabState(tabId, { queryError: params.error, result: null, resultTab: "results" });
      return;
    }

    const historyConnection = {
      connectionId: activeTab.connectionId,
      connectionName: connections.find((c) => c.id === activeTab.connectionId)?.name,
    };
    const contextId = crypto.randomUUID();
    updateTabState(tabId, {
      isRunning: true,
      runningContextId: contextId,
      cancelRequested: false,
      queryError: null,
      result: null,
      resultTab: "results",
    });

    const start = Date.now();
    try {
      const res = await executeQuery(activeConnection, {
        statement: stmt,
        timeout: "60s",
        scan_consistency: activeTab.scanConsistency ?? "not_bounded",
        parameters: params.parameters,
        named_parameters: params.named_parameters,
        client_context_id: contextId,
      });
      updateTabState(tabId, { result: res, isRunning: false, runningContextId: null });
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        statement: stmt,
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        row_count: res.metrics.result_count,
        status: "success",
        ...historyConnection,
      };
      addHistory(entry);
      setHistory(loadHistory());
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = cancelledRef.current.delete(contextId) ? `Query cancelled.\n\n${raw}` : raw;
      updateTabState(tabId, { queryError: msg, isRunning: false, runningContextId: null });
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        statement: stmt,
        executed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        row_count: 0,
        status: "error",
        error: msg,
        ...historyConnection,
      };
      addHistory(entry);
      setHistory(loadHistory());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnection, activeTabId, activeTab.paramValues, activeTab.scanConsistency, activeTab.connectionId, connections]);

  // Context ids the user asked to cancel (read inside handleRun's catch).
  const cancelledRef = useRef<Set<string>>(new Set());

  const handleCancel = useCallback(async () => {
    const contextId = activeState.runningContextId;
    if (!contextId) return;
    cancelledRef.current.add(contextId);
    updateTabState(activeTabId, { cancelRequested: true });
    try {
      await cancelQuery(activeConnection, contextId);
    } catch (e: unknown) {
      // The query may already have finished; surface nothing but keep running state honest.
      console.warn("cancel failed", e);
    }
  }, [activeConnection, activeTabId, activeState.runningContextId]);

  const handleExplain = useCallback(async (statement: string) => {
    const stmt = statement.trim();
    if (!stmt) return;
    const tabId = activeTabId;

    updateTabState(tabId, {
      isExplaining: true,
      explainPlan: null,
      explainError: null,
      resultTab: "explain",
    });

    try {
      const plan = await getExplainPlan(activeConnection, stmt);
      updateTabState(tabId, { explainPlan: plan, isExplaining: false });
    } catch (e: unknown) {
      updateTabState(tabId, {
        explainError: e instanceof Error ? e.message : String(e),
        isExplaining: false,
      });
    }
  }, [activeConnection, activeTabId]);

  const handleAdvise = useCallback(async (statement: string) => {
    const stmt = statement.trim();
    if (!stmt) return;
    const tabId = activeTabId;
    updateTabState(tabId, { isAdvising: true, advice: null, adviseError: null, resultTab: "advise" });
    try {
      const res = await executeQuery(activeConnection, { statement: adviseStatement(stmt), timeout: "30s" });
      updateTabState(tabId, { advice: parseAdvice(res.results), isAdvising: false });
    } catch (e: unknown) {
      updateTabState(tabId, {
        adviseError: e instanceof Error ? e.message : String(e),
        isAdvising: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnection, activeTabId]);

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
          className="btn btn-ghost"
          onClick={() => setShowShortcuts(true)}
          data-tooltip="Keyboard shortcuts (Ctrl+?)"
          aria-label="Keyboard shortcuts"
        >
          ⌨
        </button>
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
          <aside className="app-sidebar" ref={sidebarRef} style={{ width: layout.sidebarWidth }}>
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
                  onOpenQuery={(stmt) => handleAddTab(stmt)}
                  onKeyspacesChange={setKeyspaces}
                />
              )}
              {sideTab === "history" && (
                <QueryHistory
                  entries={history}
                  currentConnectionId={activeTab.connectionId}
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

        {sideOpen && (
          <ResizeHandle
            orientation="vertical"
            className="app-resize-handle-col"
            label="Resize side panel"
            onDrag={dragSidebar}
            onStep={(d) => setLayout({ sidebarWidth: layout.sidebarWidth + d * 20 })}
            onReset={() => setLayout({ sidebarWidth: DEFAULT_LAYOUT.sidebarWidth })}
          />
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
            onAdd={() => handleAddTab()}
            onConnectionChange={handleTabConnectionChange}
          />

          {/* Editor pane */}
          <div
            className="app-editor-pane"
            ref={editorPaneRef}
            style={{ flex: `${layout.editorRatio} 1 0` }}
          >
            <QueryEditor
              key={activeTabId}
              value={activeTab.query}
              onChange={(q) => updateActiveTab({ query: q })}
              onRun={handleRun}
              onExplain={handleExplain}
              onAdvise={handleAdvise}
              onCancel={activeState.isRunning ? handleCancel : undefined}
              isCancelling={activeState.cancelRequested}
              scanConsistency={activeTab.scanConsistency ?? "not_bounded"}
              onScanConsistencyChange={(v) => updateActiveTab({ scanConsistency: v })}
              belowToolbar={
                <ParamsPanel
                  statement={activeTab.query}
                  values={activeTab.paramValues ?? {}}
                  onChange={(paramValues) => updateActiveTab({ paramValues })}
                />
              }
              onSave={handleSaveQuery}
              isRunning={activeState.isRunning || activeState.isExplaining || activeState.isAdvising}
              schemaFields={activeState.schemaFields}
              keyspaces={keyspaces}
              monacoTheme={theme === "light" ? "nickel-light" : "nickel-dark"}
            />
          </div>

          {/* Resize handle */}
          <ResizeHandle
            orientation="horizontal"
            className="app-resize-handle"
            label="Resize editor and results"
            onDrag={dragEditorSplit}
            onStep={(d) => setLayout({ editorRatio: layout.editorRatio + d * 0.05 })}
            onReset={() => setLayout({ editorRatio: DEFAULT_LAYOUT.editorRatio })}
          />

          {/* Result pane */}
          <div
            className="app-result-pane"
            ref={resultPaneRef}
            style={{ flex: `${1 - layout.editorRatio} 1 0` }}
          >
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
              <button
                className={`result-tab ${activeState.resultTab === "advise" ? "active" : ""}`}
                onClick={() => updateTabState(activeTabId, { resultTab: "advise" })}
              >
                💡 Advise
                {activeState.advice && activeState.advice.recommended.length > 0 && (
                  <span className="result-tab-count">{activeState.advice.recommended.length}</span>
                )}
              </button>
            </div>
            <div className="result-body">
              {activeState.resultTab === "results" && (
                <ResultViewer
                  key={activeTabId}
                  result={activeState.result}
                  error={activeState.queryError}
                  isLoading={activeState.isRunning}
                />
              )}
              {activeState.resultTab === "explain" && (
                <ExplainViewer
                  key={activeTabId}
                  plan={activeState.explainPlan}
                  error={activeState.explainError}
                  isLoading={activeState.isExplaining}
                />
              )}
              {activeState.resultTab === "advise" && (
                <AdviseViewer
                  advice={activeState.advice}
                  error={activeState.adviseError}
                  isLoading={activeState.isAdvising}
                  onOpen={(stmt) => handleAddTab(stmt)}
                />
              )}
            </div>
          </div>
        </main>
      </div>
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
