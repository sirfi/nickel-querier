// ============================================================
// Nickel Querier — Single-document queries (by key)
// ============================================================
import { KeyspaceRef, keyspacePath } from "./keyspace";
import { QueryRequest } from "./types";

export function getDocumentQuery(ks: KeyspaceRef, key: string): QueryRequest {
  return {
    statement: `SELECT META(d).cas AS cas, d AS doc FROM ${keyspacePath(ks)} AS d USE KEYS $1`,
    parameters: [key],
    timeout: "10s",
    scan_consistency: "request_plus",
  };
}

export function upsertDocumentQuery(ks: KeyspaceRef, key: string, value: unknown): QueryRequest {
  return {
    statement: `UPSERT INTO ${keyspacePath(ks)} (KEY, VALUE) VALUES ($1, $2) RETURNING META().cas AS cas`,
    parameters: [key, value],
    timeout: "10s",
  };
}

export function deleteDocumentQuery(ks: KeyspaceRef, key: string): QueryRequest {
  return {
    statement: `DELETE FROM ${keyspacePath(ks)} USE KEYS $1 RETURNING META().id AS id`,
    parameters: [key],
    timeout: "10s",
  };
}

export type ParsedJson = { ok: true; value: unknown } | { ok: false; error: string };

export function parseJsonDocument(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null) {
      // Couchbase accepts scalars, but editing a scalar here is almost always a mistake
      return { ok: false, error: "The document must be a JSON object or array" };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
