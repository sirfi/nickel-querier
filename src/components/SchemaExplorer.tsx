import { useState, useEffect } from "react";
import { BucketInfo, CollectionSchema, SchemaField, ConnectionConfig } from "../lib/types";
import { listBuckets, getKeyspaceMetadata, inferSchema } from "../lib/commands";
import "./SchemaExplorer.css";

interface Props {
  config: ConnectionConfig;
  onFieldsChange: (fields: SchemaField[]) => void;
  onKeyspaceSelect: (ks: string) => void;
}

export default function SchemaExplorer({
  config,
  onFieldsChange,
  onKeyspaceSelect,
}: Props) {
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [schemas, setSchemas] = useState<Record<string, CollectionSchema[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inferring, setInferring] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const bs = await listBuckets(config);
      setBuckets(bs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.host, config.port, config.username]);

  const toggleBucket = async (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
      if (!schemas[name]) {
        try {
          const ks = await getKeyspaceMetadata(config, name);
          setSchemas((prev) => ({ ...prev, [name]: ks }));
        } catch {
          // ignore
        }
      }
    }
    setExpanded(next);
  };

  const handleInferSchema = async (keyspace: string) => {
    setInferring(keyspace);
    try {
      const fields = await inferSchema(config, keyspace);
      onFieldsChange(fields);
      onKeyspaceSelect(keyspace);
    } catch {
      // ignore infer errors
    } finally {
      setInferring(null);
    }
  };

  return (
    <div className="se-root">
      <div className="section-header">
        Schema
        <button
          className="btn btn-ghost"
          onClick={refresh}
          disabled={loading}
          style={{ padding: "1px 6px", fontSize: "11px" }}
        >
          {loading ? "…" : "↺"}
        </button>
      </div>

      {error && <div className="se-error">{error}</div>}

      {buckets.length === 0 && !loading && !error && (
        <div className="se-empty">Configure a connection to browse buckets.</div>
      )}

      <ul className="se-tree">
        {buckets.map((bucket) => (
          <li key={bucket.name}>
            <div
              className="se-bucket"
              onClick={() => toggleBucket(bucket.name)}
            >
              <span className="se-icon">
                {expanded.has(bucket.name) ? "▾" : "▸"}
              </span>
              <span className="se-bucket-name">{bucket.name}</span>
              <span className="se-bucket-type">{bucket.bucket_type}</span>
            </div>

            {expanded.has(bucket.name) && (
              <ul className="se-collections">
                {(schemas[bucket.name] ?? []).map((col) => {
                  const ks = `${bucket.name}.${col.scope}.${col.collection}`;
                  return (
                    <li
                      key={ks}
                      className="se-collection"
                      onClick={() => handleInferSchema(ks)}
                      title={`Load schema for ${ks}`}
                    >
                      <span className="se-coll-icon">⊡</span>
                      <span className="se-coll-name">
                        {col.scope === "_default" && col.collection === "_default"
                          ? bucket.name
                          : `${col.scope}.${col.collection}`}
                      </span>
                      {inferring === ks && (
                        <span className="se-inferring">…</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
