import { useState, useEffect } from "react";
import { ConnectionConfig } from "../lib/types";
import { testConnection } from "../lib/commands";
import { loadConnection, saveConnection } from "../lib/storage";
import "./ConnectionPanel.css";

interface Props {
  config: ConnectionConfig;
  onChange: (config: ConnectionConfig) => void;
}

export default function ConnectionPanel({ config, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ConnectionConfig>(config);
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const stored = loadConnection();
    const updated: ConnectionConfig = { ...stored };
    onChange(updated);
    setDraft(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTest = async () => {
    setStatus("testing");
    setErrorMsg("");
    try {
      await testConnection(draft);
      setStatus("ok");
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = () => {
    saveConnection(draft);
    onChange(draft);
    setEditing(false);
    setStatus("idle");
  };

  const handleCancel = () => {
    setDraft(config);
    setEditing(false);
    setStatus("idle");
  };

  const statusBadge = () => {
    if (status === "testing") return <span className="conn-badge testing">Connecting…</span>;
    if (status === "ok") return <span className="conn-badge ok">● Connected</span>;
    if (status === "error") return <span className="conn-badge error">✕ Error</span>;
    return null;
  };

  if (!editing) {
    return (
      <div className="conn-bar">
        <span className="conn-host truncate">
          {config.tls ? "https" : "http"}://{config.host}:{config.port}
        </span>
        {statusBadge()}
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          ⚙ Configure
        </button>
      </div>
    );
  }

  return (
    <div className="conn-modal-overlay">
      <div className="conn-modal">
        <h2 className="conn-title">
          <span className="nickel-logo">⬡</span> Connection Settings
        </h2>

        <div className="conn-grid">
          <div className="input-group" style={{ gridColumn: "1 / 3" }}>
            <label>Host</label>
            <input
              className="input"
              value={draft.host}
              onChange={(e) => setDraft({ ...draft, host: e.target.value })}
              placeholder="localhost"
            />
          </div>

          <div className="input-group">
            <label>Query Port</label>
            <input
              className="input"
              type="number"
              value={draft.port}
              onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })}
              placeholder="8093"
            />
          </div>

          <div className="input-group" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <label className="conn-tls-label">
              <input
                type="checkbox"
                checked={draft.tls}
                onChange={(e) => setDraft({ ...draft, tls: e.target.checked })}
              />
              TLS / HTTPS
            </label>
          </div>

          <div className="input-group">
            <label>Username</label>
            <input
              className="input"
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              placeholder="Administrator"
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
        </div>

        {status === "error" && (
          <p className="conn-error-msg">{errorMsg}</p>
        )}

        <div className="conn-actions">
          <button className="btn" onClick={handleTest} disabled={status === "testing"}>
            Test Connection
          </button>
          {statusBadge()}
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save & Apply</button>
        </div>
      </div>
    </div>
  );
}
