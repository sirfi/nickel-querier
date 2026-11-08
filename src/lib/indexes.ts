// ============================================================
// Nickel Querier — Index Advisor & index listing helpers
// ============================================================
import { KeyspaceRef } from "./keyspace";
import { QueryRequest } from "./types";

export interface AdvisedIndex {
  statement: string;
  /** Why the advisor recommends it (e.g. "Index keys follow order of predicate types…") */
  rule?: string;
  covering: boolean;
}

export interface CurrentIndex {
  statement: string;
  status?: string;
}

export interface Advice {
  recommended: AdvisedIndex[];
  current: CurrentIndex[];
  /** Advisor messages such as "No secondary index recommendation at this time." */
  messages: string[];
}

/** Prefix a statement with ADVISE (unless it already starts with it). */
export function adviseStatement(statement: string): string {
  const s = statement.trim().replace(/;+\s*$/, "");
  return /^advise\b/i.test(s) ? s : `ADVISE ${s}`;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Parse the result rows of `ADVISE <statement>` (Couchbase 6.6 – 7.x shapes). */
export function parseAdvice(results: unknown[]): Advice {
  const advice: Advice = { recommended: [], current: [], messages: [] };
  const seen = new Set<string>();

  for (const row of results) {
    if (!isObj(row)) continue;
    const adv = isObj(row.advice) ? row.advice : row;
    const infos = Array.isArray(adv.adviseinfo) ? adv.adviseinfo : [adv.adviseinfo];
    for (const info of infos) {
      if (!isObj(info)) continue;
      for (const c of arr(info.current_indexes)) {
        if (isObj(c) && typeof c.index_statement === "string") {
          advice.current.push({
            statement: c.index_statement,
            status: typeof c.index_status === "string" ? c.index_status : undefined,
          });
        }
      }
      const rec = info.recommended_indexes;
      if (typeof rec === "string") advice.messages.push(rec);
      if (isObj(rec)) {
        for (const [key, covering] of [["indexes", false], ["covering_indexes", true]] as const) {
          for (const r of arr(rec[key])) {
            if (!isObj(r) || typeof r.index_statement !== "string" || seen.has(r.index_statement)) continue;
            seen.add(r.index_statement);
            advice.recommended.push({
              statement: r.index_statement,
              rule: typeof r.recommending_rule === "string" ? r.recommending_rule : undefined,
              covering,
            });
          }
        }
        if (typeof rec.message === "string") advice.messages.push(rec.message);
      }
      if (typeof info.message === "string") advice.messages.push(info.message);
    }
  }
  if (advice.recommended.length === 0 && advice.messages.length === 0) {
    advice.messages.push("No index recommendation for this statement.");
  }
  return advice;
}

export interface IndexInfo {
  name: string;
  index_key: string[];
  condition?: string;
  is_primary?: boolean;
  state?: string;
  using?: string;
}

/** Query listing the indexes on a keyspace (works for collections and pre-7.0 buckets). */
export function indexListQuery(ks: KeyspaceRef): QueryRequest {
  const isDefault = ks.scope === "_default" && ks.collection === "_default";
  const where = isDefault
    ? "((keyspace_id = $1 AND bucket_id IS MISSING) OR (bucket_id = $1 AND scope_id = '_default' AND keyspace_id = '_default'))"
    : "(bucket_id = $1 AND scope_id = $2 AND keyspace_id = $3)";
  return {
    statement:
      "SELECT i.name, i.index_key, i.`condition`, i.is_primary, i.state, i.`using` " +
      `FROM system:indexes AS i WHERE ${where} ORDER BY i.is_primary DESC, i.name`,
    parameters: isDefault ? [ks.bucket] : [ks.bucket, ks.scope, ks.collection],
    timeout: "10s",
  };
}

export function describeIndex(i: IndexInfo): string {
  if (i.is_primary) return "PRIMARY";
  const keys = (i.index_key ?? []).join(", ");
  return i.condition ? `(${keys}) WHERE ${i.condition}` : `(${keys})`;
}
