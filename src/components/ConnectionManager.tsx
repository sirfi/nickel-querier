import { useState } from "react";
import { SavedConnection } from "../lib/types";
import { testConnection, deleteConnectionSecret } from "../lib/commands";
import { secureConnection } from "../lib/secrets";
import { addConnection, updateConnection, deleteConnection } from "../lib/storage";
import "./ConnectionManager.css";

interface Props {
  connections: SavedConnection[];
  onClose: () => void;
  onConnectionsChange: (connections: SavedConnection[]) => void;
}

type FormMode = "add" | "edit" | null;
type TestStatus = "idle" | "testing" | "ok" | "error";

const EMPTY_FORM: Omit<SavedConnection, "id"> = {
  name: "",
  host: "localhost",
  port: 8093,
  username: "Administrator",
  password: "",
  tls: false,
};

export default function ConnectionManager({
  connections,
  onClose,
  onConnectionsChange,
}: Props) {
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<SavedConnection, "id">>(EMPTY_FORM);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setDraft(EMPTY_FORM);
    setEditingId(null);
    setFormMode("add");
    setTestStatus("idle");
    setTestError("");
  };

  const openEdit = (conn: SavedConnection) => {
    setDraft({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      // Keychain passwords are never shown; leaving the field blank keeps them.
      password: conn.keychain ? "" : conn.password,
      tls: conn.tls,
      verify_tls: conn.verify_tls,
      mgmt_port: conn.mgmt_port,
      keychain: conn.keychain,
    });
    setEditingId(conn.id);
    setFormMode("edit");
    setTestStatus("idle");
    setTestError("");
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      await testConnection({
        host: draft.host,
        port: draft.port,
        username: draft.username,
        password: draft.password,
        tls: draft.tls,
        verify_tls: draft.verify_tls,
        mgmt_port: draft.mgmt_port,
        id: editingId ?? undefined,
        keychain: !!draft.keychain && !draft.password,
      });
      setTestStatus("ok");
    } catch (e: unknown) {
      setTestStatus("error");
      setTestError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = async () => {
    if (!draft.name.trim() || saving) return;
    const id = formMode === "edit" && editingId ? editingId : crypto.randomUUID();
    const original = connections.find((c) => c.id === id);
    const base: SavedConnection = { id, ...draft, name: draft.name.trim() };

    setSaving(true);
    let conn: SavedConnection;
    let warning: string | undefined;
    if (!draft.password && original?.keychain) {
      // Blank password while editing = keep the one in the keychain
      conn = { ...base, password: "", keychain: true };
    } else {
      ({ connection: conn, warning } = await secureConnection({ ...base, keychain: false }));
    }
    setSaving(false);
    setNotice(warning ?? null);

    if (formMode === "add") {
      addConnection(conn);
      onConnectionsChange([...connections, conn]);
    } else {
      updateConnection(conn);
      onConnectionsChange(connections.map((c) => (c.id === id ? conn : c)));
    }
    setFormMode(null);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteConnectionSecret(id).catch(() => {
      /* not in keychain / keychain unavailable */
    });
    deleteConnection(id);
    onConnectionsChange(connections.filter((c) => c.id !== id));
  };

  const handleCancel = () => {
    setFormMode(null);
    setEditingId(null);
    setTestStatus("idle");
    setTestError("");
  };

  const testBadge = () => {
    if (testStatus === "testing") return <span className="conn-badge testing">Connecting…</span>;
    if (testStatus === "ok") return <span className="conn-badge ok">● Connected</span>;
    if (testStatus === "error") return <span className="conn-badge error">✕ Error</span>;
    return null;
  };

  return (
    <div className="cm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cm-modal">
        <div className="cm-header">
          <h2 className="cm-title">
            <span className="nickel-logo">⬡</span> Manage Connections
          </h2>
          <button className="btn btn-ghost cm-close" onClick={onClose}>✕</button>
        </div>

        {notice && <div className="cm-notice">⚠ {notice}</div>}

        {/* Connection list */}
        <div className="cm-list">
          {connections.length === 0 && (
            <div className="cm-empty">No connections saved. Add one below.</div>
          )}
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={`cm-item ${editingId === conn.id ? "editing" : ""}`}
            >
              <div className="cm-item-info">
                <span className="cm-item-name">{conn.name}</span>
                <span className="cm-item-host">
                  {conn.tls ? "https" : "http"}://{conn.host}:{conn.port}
                  {conn.tls && conn.verify_tls === false && (
                    <span title="Certificate verification is off"> ⚠</span>
                  )}
                </span>
                <span className="cm-item-user">
                  {conn.username}
                  {conn.keychain && <span title="Password stored in the OS keychain"> · 🔒</span>}
                </span>
              </div>
              <div className="cm-item-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => openEdit(conn)}
                  data-tooltip="Edit connection"
                >
                  ✎
                </button>
                <button
                  className="btn btn-ghost btn-danger-ghost"
                  onClick={() => handleDelete(conn.id)}
                  data-tooltip="Delete connection"
                  disabled={connections.length === 1}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Form: add or edit */}
        {formMode !== null ? (
          <div className="cm-form">
            <h3 className="cm-form-title">
              {formMode === "add" ? "New Connection" : "Edit Connection"}
            </h3>

            <div className="cm-form-grid">
              <div className="input-group" style={{ gridColumn: "1 / 3" }}>
                <label>Name</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Production, Staging…"
                  autoFocus
                />
              </div>

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
                {draft.tls && (
                  <label
                    className="conn-tls-label"
                    title="Turn off only for self-signed certificates on trusted networks"
                  >
                    <input
                      type="checkbox"
                      checked={draft.verify_tls !== false}
                      onChange={(e) => setDraft({ ...draft, verify_tls: e.target.checked })}
                    />
                    Verify TLS certificate
                  </label>
                )}
              </div>

              <div className="input-group">
                <label>Management Port</label>
                <input
                  className="input"
                  type="number"
                  value={draft.mgmt_port ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      mgmt_port: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder={draft.tls ? "18091" : "8091"}
                />
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
                  placeholder={
                    formMode === "edit" && draft.keychain
                      ? "Stored in keychain — leave blank to keep"
                      : "••••••••"
                  }
                />
              </div>
            </div>

            {testStatus === "error" && (
              <p className="conn-error-msg">{testError}</p>
            )}

            <div className="cm-form-actions">
              <button className="btn" onClick={handleTest} disabled={testStatus === "testing"}>
                Test
              </button>
              {testBadge()}
              <span style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!draft.name.trim() || saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="cm-footer">
            <button className="btn btn-primary" onClick={openAdd}>
              + Add Connection
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
