import { useState, useEffect, useCallback, useRef } from "react";
import ConnectionPanel from "./components/ConnectionPanel";
import QueryEditor from "./components/QueryEditor";
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
} from "./lib/storage";

import {
  ConnectionConfig,
  QueryResult,
  HistoryEntry,
  SavedQuery,
  SchemaField,
} from "./lib/types";

import "./styles/App.css";

type SideTab = "schema" | "history" | "saved";
type ResultTab = "results" | "explain";

const DEFAULT_QUERY = `-- Welcome to Nickel Querier ⬡  SQL+++ for Couchbase
-- Press Ctrl+Enter (or ⌘+Enter) to run · Ctrl+Shift+E for EXPLAIN

SELECT "Hello from Nickel Querier!" AS greeting,
       NOW_STR() AS ts;
`;

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig>({
    host: "localhost",
    port: 8093,
    username: "Administrator",
    password: "",
    tls: false,
  });

  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [explainPlan, setExplainPlan] = useState<unknown>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const [sideTab, setSideTab] = useState<SideTab>("schema");
  const [resultTab, setResultTab] = useState<ResultTab>("results");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);

  // Show/hide side panel
  const [sideOpen, setSideOpen] = useState(true);

  const editorRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setSavedQueries(loadSavedQueries());
  }, []);

  const getActiveStatement = useCallback((): string => {
    const el = editorRootRef.current;
    if (el) {
      const fn = (el as HTMLElement & { getActiveStatement?: () => string })
        .getActiveStatement;
      if (fn) return fn();
    }
    return query;
  }, [query]);

  const handleRun = useCallback(async () => {
    const stmt = getActiveStatement().trim();
    if (!stmt) return;

    setIsRunning(true);
    setQueryError(null);
    setResult(null);
    setResultTab("results");

    const start = Date.now();
    try {
      const res = await executeQuery(config, {
        statement: stmt,
        timeout: "60s",
        scan_consistency: "not_bounded",
      });
      setResult(res);
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
      setQueryError(msg);
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
    } finally {
      setIsRunning(false);
    }
  }, [config, getActiveStatement]);

  const handleExplain = useCallback(async () => {
    const stmt = getActiveStatement().trim();
    if (!stmt) return;

    setIsExplaining(true);
    setExplainPlan(null);
    setResultTab("explain");

    try {
      const plan = await getExplainPlan(config, stmt);
      setExplainPlan(plan);
    } catch (e: unknown) {
      setExplainPlan({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsExplaining(false);
    }
  }, [config, getActiveStatement]);

  const handleSaveQuery = () => {
    setSideTab("saved");
    setSideOpen(true);
  };

  const handleHistorySelect = (stmt: string) => {
    setQuery(stmt);
  };

  const handleSavedSelect = (stmt: string) => {
    setQuery(stmt);
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
        <ConnectionPanel config={config} onChange={setConfig} />
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
                  config={config}
                  onFieldsChange={setSchemaFields}
                  onKeyspaceSelect={(ks) => {
                    setQuery(`SELECT * FROM \`${ks}\` LIMIT 10;`);
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
                  pendingStatement={query}
                />
              )}
            </div>
          </aside>
        )}

        {/* Main content: editor + results */}
        <main className="app-main">
          {/* Editor pane */}
          <div className="app-editor-pane" ref={editorRootRef}>
            <QueryEditor
              value={query}
              onChange={setQuery}
              onRun={handleRun}
              onExplain={handleExplain}
              onSave={handleSaveQuery}
              isRunning={isRunning || isExplaining}
              schemaFields={schemaFields}
            />
          </div>

          {/* Resize handle */}
          <div className="app-resize-handle" />

          {/* Result pane */}
          <div className="app-result-pane">
            <div className="result-tabs">
              <button
                className={`result-tab ${resultTab === "results" ? "active" : ""}`}
                onClick={() => setResultTab("results")}
              >
                ⊞ Results
                {result && (
                  <span className="result-tab-count">
                    {result.metrics.result_count}
                  </span>
                )}
              </button>
              <button
                className={`result-tab ${resultTab === "explain" ? "active" : ""}`}
                onClick={() => setResultTab("explain")}
              >
                ⚡ Explain
              </button>
            </div>
            <div className="result-body">
              {resultTab === "results" && (
                <ResultViewer
                  result={result}
                  error={queryError}
                  isLoading={isRunning}
                />
              )}
              {resultTab === "explain" && (
                <ExplainViewer plan={isExplaining ? null : explainPlan} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
