import { useState, useEffect, useCallback, useRef } from "react";
import { BucketInfo, CollectionSchema, SchemaField, ConnectionConfig } from "../lib/types";
import { listBuckets, getKeyspaceMetadata, inferSchema, executeQuery } from "../lib/commands";
import { IndexInfo, indexListQuery, describeIndex } from "../lib/indexes";
import { KeyspaceRef, keyspaceId, sampleQuery } from "../lib/keyspace";
import "./SchemaExplorer.css";

interface Props {
  config: ConnectionConfig;
  /** Fields of the most recently inferred collection (used for autocomplete). */
  onFieldsChange: (fields: SchemaField[]) => void;
  /** Open a sample query for the keyspace (the parent decides where). */
  onOpenQuery: (statement: string) => void;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SchemaExplorer({ config, onFieldsChange, onOpenQuery }: Props) {
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [schemas, setSchemas] = useState<Record<string, CollectionSchema[]>>({});
  const [fields, setFields] = useState<Record<string, SchemaField[]>>({});
  const [indexes, setIndexes] = useState<Record<string, IndexInfo[] | string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  // Identity of the connection: any change invalidates the cached tree.
  const connKey = `${config.tls}|${config.host}|${config.port}|${config.username}|${config.password}`;
  const connKeyRef = useRef(connKey);
  connKeyRef.current = connKey;

  const setBusyFlag = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const refresh = useCallback(async () => {
    const key = connKeyRef.current;
    setLoading(true);
    setError(null);
    setSchemas({});
    setFields({});
    setIndexes({});
    setItemErrors({});
    setExpanded(new Set());
    try {
      const bs = await listBuckets(config);
      if (connKeyRef.current !== key) return; // connection changed meanwhile
      setBuckets([...bs].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: unknown) {
      if (connKeyRef.current !== key) return;
      setBuckets([]);
      setError(errMsg(e));
    } finally {
      if (connKeyRef.current === key) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleBucket = async (name: string) => {
    const id = `b:${name}`;
    toggle(id);
    if (expanded.has(id) || schemas[name]) return;
    setBusyFlag(id, true);
    try {
      const ks = await getKeyspaceMetadata(config, name);
      setSchemas((prev) => ({ ...prev, [name]: ks }));
      setItemErrors(({ [id]: _, ...rest }) => rest);
    } catch (e) {
      setItemErrors((prev) => ({ ...prev, [id]: errMsg(e) }));
    } finally {
      setBusyFlag(id, false);
    }
  };

  const toggleCollection = async (ks: KeyspaceRef, force = false) => {
    const id = keyspaceId(ks);
    if (!force) toggle(`c:${id}`);
    const cached = fields[id];
    if (cached && !force) {
      if (!expanded.has(`c:${id}`)) onFieldsChange(cached);
      return;
    }
    if (force) setExpanded((prev) => new Set(prev).add(`c:${id}`));
    setBusyFlag(id, true);
    // Index list loads in parallel; its failure must not hide the fields.
    executeQuery(config, indexListQuery(ks))
      .then((r) => setIndexes((prev) => ({ ...prev, [id]: r.results as IndexInfo[] })))
      .catch((e) => setIndexes((prev) => ({ ...prev, [id]: errMsg(e) })));
    try {
      const fs = await inferSchema(config, ks);
      setFields((prev) => ({ ...prev, [id]: fs }));
      setItemErrors(({ [id]: _, ...rest }) => rest);
      onFieldsChange(fs);
    } catch (e) {
      setItemErrors((prev) => ({ ...prev, [id]: errMsg(e) }));
    } finally {
      setBusyFlag(id, false);
    }
  };

  const needle = filter.trim().toLowerCase();
  const visibleBuckets = needle
    ? buckets.filter(
        (b) =>
          b.name.toLowerCase().includes(needle) ||
          (schemas[b.name] ?? []).some((c) =>
            `${c.scope}.${c.collection}`.toLowerCase().includes(needle)
          )
      )
    : buckets;

  return (
    <div className="se-root">
      <div className="section-header">
        Schema
        <button
          className="btn btn-ghost"
          onClick={refresh}
          disabled={loading}
          style={{ padding: "1px 6px", fontSize: "11px" }}
          title="Reload buckets"
        >
          {loading ? "…" : "↺"}
        </button>
      </div>

      {buckets.length > 0 && (
        <div className="se-filter">
          <input
            className="input"
            placeholder="Filter buckets / collections…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}

      {error && <div className="se-error">{error}</div>}

      {buckets.length === 0 && !loading && !error && (
        <div className="se-empty">No buckets found for this connection.</div>
      )}

      <ul className="se-tree">
        {visibleBuckets.map((bucket) => {
          const bid = `b:${bucket.name}`;
          const cols = schemas[bucket.name] ?? [];
          const visibleCols = needle && !bucket.name.toLowerCase().includes(needle)
            ? cols.filter((c) => `${c.scope}.${c.collection}`.toLowerCase().includes(needle))
            : cols;
          return (
            <li key={bucket.name}>
              <div className="se-bucket" onClick={() => toggleBucket(bucket.name)}>
                <span className="se-icon">{expanded.has(bid) ? "▾" : "▸"}</span>
                <span className="se-bucket-name">{bucket.name}</span>
                {busy.has(bid) && <span className="se-inferring">…</span>}
                <span className="se-bucket-type">{bucket.bucket_type}</span>
              </div>
              {itemErrors[bid] && <div className="se-item-error">{itemErrors[bid]}</div>}

              {expanded.has(bid) && (
                <ul className="se-collections">
                  {visibleCols.map((col) => {
                    const ks: KeyspaceRef = {
                      bucket: bucket.name,
                      scope: col.scope,
                      collection: col.collection,
                    };
                    const id = keyspaceId(ks);
                    const cid = `c:${id}`;
                    const fs = fields[id];
                    return (
                      <li key={id}>
                        <div
                          className="se-collection"
                          onClick={() => toggleCollection(ks)}
                          title="Show fields (runs INFER) and use them for autocomplete"
                        >
                          <span className="se-icon">{expanded.has(cid) ? "▾" : "▸"}</span>
                          <span className="se-coll-name">
                            {col.scope === "_default" && col.collection === "_default"
                              ? "_default"
                              : `${col.scope}.${col.collection}`}
                          </span>
                          {busy.has(id) && <span className="se-inferring">…</span>}
                          <button
                            className="se-action"
                            title="Open a sample SELECT in a new tab"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenQuery(sampleQuery(ks));
                            }}
                          >
                            ▶
                          </button>
                          {fs && (
                            <button
                              className="se-action"
                              title="Re-run INFER"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCollection(ks, true);
                              }}
                            >
                              ↺
                            </button>
                          )}
                        </div>
                        {itemErrors[id] && <div className="se-item-error">{itemErrors[id]}</div>}
                        {expanded.has(cid) && fs && (
                          <ul className="se-fields">
                            <li className="se-section">Fields</li>
                            {fs.length === 0 && <li className="se-field-empty">No fields inferred</li>}
                            {fs.map((f) => (
                              <li key={f.name} className="se-field" title={`${f.name}: ${f.field_type}`}>
                                <span className="se-field-name">{f.name}</span>
                                <span className="se-field-type">{f.field_type}</span>
                              </li>
                            ))}
                            <IndexList value={indexes[id]} />
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IndexList({ value }: { value: IndexInfo[] | string | undefined }) {
  if (value === undefined) return null;
  return (
    <>
      <li className="se-section">Indexes</li>
      {typeof value === "string" ? (
        <li className="se-item-error">{value}</li>
      ) : value.length === 0 ? (
        <li className="se-field-empty">No indexes — queries need a primary or secondary index</li>
      ) : (
        value.map((i) => (
          <li key={i.name} className="se-field" title={`${i.name} ${describeIndex(i)}`}>
            <span className="se-field-name">
              {i.is_primary ? "⚿ " : "⌗ "}
              {i.name}
            </span>
            <span className="se-field-type">
              {describeIndex(i)}
              {i.state && i.state !== "online" ? ` · ${i.state}` : ""}
            </span>
          </li>
        ))
      )}
    </>
  );
}
