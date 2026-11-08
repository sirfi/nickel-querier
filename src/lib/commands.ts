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
import type { KeyspaceRef } from "./keyspace";

// Detect whether we're running inside Tauri or a plain browser
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Rust `AppError` values are serialized as `{ "Query": "msg" }` etc.
 * Turn them (or any other rejection) into a readable message.
 */
export function formatCommandError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const entries = Object.entries(e as Record<string, unknown>);
    if (entries.length === 1) {
      const [kind, msg] = entries[0];
      const label: Record<string, string> = {
        Http: "HTTP error",
        Query: "Query error",
        Connection: "Connection error",
        Json: "Invalid response",
      };
      return `${label[kind] ?? kind}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`;
    }
    return JSON.stringify(e);
  }
  return String(e);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    try {
      return await tauriInvoke<T>(cmd, args);
    } catch (e) {
      throw new Error(formatCommandError(e));
    }
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
  keyspace: KeyspaceRef
): Promise<SchemaField[]> {
  return invoke<SchemaField[]>("infer_schema", {
    config,
    bucket: keyspace.bucket,
    scope: keyspace.scope,
    collection: keyspace.collection,
  });
}

export async function testConnection(
  config: ConnectionConfig
): Promise<boolean> {
  return invoke<boolean>("test_connection", { config });
}
