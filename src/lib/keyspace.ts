// ============================================================
// Nickel Querier — Keyspace helpers
// ============================================================

export interface KeyspaceRef {
  bucket: string;
  scope: string;
  collection: string;
}

/** Quote a single N1QL identifier with backticks (escaping embedded backticks). */
export function quoteIdentifier(name: string): string {
  return "`" + name.replace(/`/g, "``") + "`";
}

/**
 * Build a properly quoted keyspace path.
 * `_default._default` collections collapse to just the bucket so that the
 * query also works on pre-7.0 clusters.
 */
export function keyspacePath(ks: KeyspaceRef): string {
  if (ks.scope === "_default" && ks.collection === "_default") {
    return quoteIdentifier(ks.bucket);
  }
  return [ks.bucket, ks.scope, ks.collection].map(quoteIdentifier).join(".");
}

/** Human-readable id, used as a React key / label. */
export function keyspaceId(ks: KeyspaceRef): string {
  return `${ks.bucket}.${ks.scope}.${ks.collection}`;
}

export function sampleQuery(ks: KeyspaceRef, limit = 10): string {
  return `SELECT * FROM ${keyspacePath(ks)} LIMIT ${limit};`;
}
