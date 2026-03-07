import { useState } from "react";
import { SavedConnection } from "../lib/types";
import { testConnection } from "../lib/commands";
import ConnectionManager from "./ConnectionManager";
import "./ConnectionPanel.css";

interface Props {
  connections: SavedConnection[];
  selectedId: string;
  onSelect: (id: string) => void;
  onConnectionsChange: (connections: SavedConnection[]) => void;
}

export default function ConnectionPanel({
  connections,
  selectedId,
  onSelect,
  onConnectionsChange,
}: Props) {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showManager, setShowManager] = useState(false);

  const selected = connections.find((c) => c.id === selectedId) ?? connections[0];

  const handleTest = async () => {
    if (!selected) return;
    setStatus("testing");
    setErrorMsg("");
    try {
      await testConnection({
        host: selected.host,
        port: selected.port,
        username: selected.username,
        password: selected.password,
        tls: selected.tls,
      });
      setStatus("ok");
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const statusBadge = () => {
    if (status === "testing") return <span className="conn-badge testing">Connecting…</span>;
    if (status === "ok") return <span className="conn-badge ok">● Connected</span>;
    if (status === "error") return (
      <span className="conn-badge error" data-tooltip={errorMsg}>✕ Error</span>
    );
    return null;
  };

  return (
    <>
      <div className="conn-bar">
        <select
          className="conn-select"
          value={selectedId}
          onChange={(e) => {
            onSelect(e.target.value);
            setStatus("idle");
          }}
          title="Select connection"
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.tls ? "https" : "http"}://{c.host}:{c.port}
            </option>
          ))}
        </select>

        {statusBadge()}

        <button
          className="btn btn-ghost"
          onClick={handleTest}
          disabled={status === "testing"}
          data-tooltip="Test connection"
        >
          ⚡ Test
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => setShowManager(true)}
          data-tooltip="Manage connections"
        >
          ⚙ Manage
        </button>
      </div>

      {showManager && (
        <ConnectionManager
          connections={connections}
          onClose={() => setShowManager(false)}
          onConnectionsChange={(updated) => {
            onConnectionsChange(updated);
            // If the selected connection was deleted, switch to the first available
            if (!updated.find((c) => c.id === selectedId) && updated.length > 0) {
              onSelect(updated[0].id);
            }
            setStatus("idle");
          }}
        />
      )}
    </>
  );
}
