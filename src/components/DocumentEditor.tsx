import { useState, useEffect, useCallback } from "react";
import { ConnectionConfig } from "../lib/types";
import { executeQuery } from "../lib/commands";
import { KeyspaceRef, keyspacePath } from "../lib/keyspace";
import {
  getDocumentQuery,
  upsertDocumentQuery,
  deleteDocumentQuery,
  parseJsonDocument,
} from "../lib/documents";
import "./ConnectionManager.css";
import "./DocumentEditor.css";

interface Props {
  config: ConnectionConfig;
  keyspace: KeyspaceRef;
  initialKey?: string;
  onClose: () => void;
}

type Status = { kind: "info" | "ok" | "error"; text: string } | null;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Load, edit, save (UPSERT) and delete a single document by key. */
export default function DocumentEditor({ config, keyspace, initialKey = "", onClose }: Props) {
  const [key, setKey] = useState(initialKey);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const dirty = text !== savedText;
  const parsed = text.trim() ? parseJsonDocument(text) : null;

  const load = useCallback(async (k: string) => {
    if (!k.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await executeQuery(config, getDocumentQuery(keyspace, k));
      const row = res.results[0] as { doc?: unknown } | undefined;
      if (!row) {
        const empty = "{\n  \n}";
        setText(empty);
        setSavedText("");
        setStatus({ kind: "info", text: "Document not found — Save will create it." });
      } else {
        const pretty = JSON.stringify(row.doc, null, 2);
        setText(pretty);
        setSavedText(pretty);
      }
      setLoadedKey(k);
    } catch (e) {
      // Never leave the previous document editable under a different key
      setLoadedKey(null);
      setText("");
      setSavedText("");
      setStatus({ kind: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }, [config, keyspace]);

  useEffect(() => {
    if (initialKey) load(initialKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!parsed?.ok || !loadedKey) return;
    setBusy(true);
    try {
      await executeQuery(config, upsertDocumentQuery(keyspace, loadedKey, parsed.value));
      const pretty = JSON.stringify(parsed.value, null, 2);
      setText(pretty);
      setSavedText(pretty);
      setStatus({ kind: "ok", text: `Saved ${loadedKey}` });
    } catch (e) {
      setStatus({ kind: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!loadedKey || !window.confirm(`Delete document "${loadedKey}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await executeQuery(config, deleteDocumentQuery(keyspace, loadedKey));
      setStatus(
        res.results.length > 0
          ? { kind: "ok", text: `Deleted ${loadedKey}` }
          : { kind: "info", text: "Nothing deleted — the document does not exist." }
      );
      setText("");
      setSavedText("");
      setLoadedKey(null);
    } catch (e) {
      setStatus({ kind: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  };

  return (
    <div className="cm-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="cm-modal de-modal" role="dialog" aria-label="Document editor">
        <div className="cm-header">
          <h2 className="cm-title">✎ Document</h2>
          <code className="de-keyspace">{keyspacePath(keyspace)}</code>
          <button className="btn btn-ghost cm-close" onClick={close} aria-label="Close">✕</button>
        </div>

        <form
          className="de-keybar"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && loadedKey && !window.confirm("Discard unsaved changes?")) return;
            load(key);
          }}
        >
          <input
            className="input de-key"
            placeholder="Document key (META().id)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
          <button className="btn" type="submit" disabled={busy || !key.trim()}>
            Load
          </button>
        </form>

        <textarea
          className="de-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          disabled={!loadedKey || busy}
          placeholder="Load a document by key to edit it"
          aria-label="Document JSON"
        />

        <div className="de-footer">
          {parsed && !parsed.ok ? (
            <span className="de-status de-error">Invalid JSON: {parsed.error}</span>
          ) : status ? (
            <span className={`de-status de-${status.kind}`}>{status.text}</span>
          ) : (
            <span className="de-status">{dirty ? "Unsaved changes" : ""}</span>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn btn-danger" onClick={remove} disabled={!loadedKey || busy}>
            Delete
          </button>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!loadedKey || busy || !dirty || !parsed?.ok}
          >
            {busy ? "…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
