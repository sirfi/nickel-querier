// ============================================================
// Nickel Querier — Tauri Command Wrappers
// ============================================================
import {
  ConnectionConfig,
  QueryRequest,
  QueryResult,
  BucketInfo,
  CollectionSchema,
  SchemaField,
} from "./types";

// Detect whether we're running inside Tauri or a plain browser
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // Browser/dev fallback — call via HTTP (useful when running `npm run dev` standalone)
  throw new Error(
    `Tauri not available. Command "${cmd}" requires the desktop app.`
  );
}

export async function executeQuery(
  config: ConnectionConfig,
  request: QueryRequest
): Promise<QueryResult> {
  return invoke<QueryResult>("execute_query", { config, request });
}

export async function getExplainPlan(
  config: ConnectionConfig,
  statement: string
): Promise<unknown> {
  return invoke<unknown>("get_explain_plan", { config, statement });
}

export async function listBuckets(
  config: ConnectionConfig
): Promise<BucketInfo[]> {
  return invoke<BucketInfo[]>("list_buckets", { config });
}

export async function getKeyspaceMetadata(
  config: ConnectionConfig,
  bucket: string
): Promise<CollectionSchema[]> {
  return invoke<CollectionSchema[]>("get_keyspace_metadata", { config, bucket });
}

export async function inferSchema(
  config: ConnectionConfig,
  keyspace: string
): Promise<SchemaField[]> {
  return invoke<SchemaField[]>("infer_schema", { config, keyspace });
}

export async function testConnection(
  config: ConnectionConfig
): Promise<boolean> {
  return invoke<boolean>("test_connection", { config });
}
