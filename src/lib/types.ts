// ============================================================
// Nickel Querier — Shared Types
// ============================================================

export interface ConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

export interface QueryRequest {
  statement: string;
  timeout?: string;
  scan_consistency?: string;
  parameters?: unknown[];
}

export interface QueryMetrics {
  elapsed_time: string;
  execution_time: string;
  result_count: number;
  result_size: number;
  mutation_count: number;
  error_count: number;
  warning_count: number;
}

export interface QueryResult {
  results: unknown[];
  status: string;
  metrics: QueryMetrics;
  warnings: unknown[];
  errors: unknown[];
}

export interface BucketInfo {
  name: string;
  bucket_type: string;
  quota_used?: number;
}

export interface SchemaField {
  name: string;
  field_type: string;
}

export interface CollectionSchema {
  bucket: string;
  scope: string;
  collection: string;
  fields: SchemaField[];
}

export interface HistoryEntry {
  id: string;
  statement: string;
  executed_at: string; // ISO string
  duration_ms: number;
  row_count: number;
  status: "success" | "error";
  error?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  statement: string;
  created_at: string;
  tags: string[];
}

export type TabId = "results" | "explain" | "history" | "saved";

export interface Tab {
  id: TabId;
  label: string;
}
