// ============================================================
// Nickel Querier — Split a script into statements
// ============================================================
import { tokenize } from "./n1ql-formatter";

export interface StatementRange {
  /** Start offset (inclusive) */
  start: number;
  /** End offset (exclusive), includes the terminating `;` if any */
  end: number;
  text: string;
}

/** True when the text contains code (not only whitespace / comments). */
function hasCode(text: string): boolean {
  return tokenize(text).some((t) => t.type !== "ws" && t.type !== "comment" && t.text !== ";");
}

/** Split on `;` outside strings, identifiers and comments. Empty statements are dropped. */
export function splitStatements(sql: string): StatementRange[] {
  const out: StatementRange[] = [];
  let start = 0;
  let pos = 0;
  for (const tok of tokenize(sql)) {
    pos += tok.text.length;
    if (tok.type === "punct" && tok.text === ";") {
      out.push({ start, end: pos, text: sql.slice(start, pos) });
      start = pos;
    }
  }
  if (start < sql.length) out.push({ start, end: sql.length, text: sql.slice(start) });
  return out.filter((s) => hasCode(s.text));
}

/**
 * The statement the cursor is in. Whitespace before a statement belongs to
 * the previous one, so a cursor right after `;` (or on the blank lines
 * after it) selects the statement before it.
 */
export function statementAtOffset(sql: string, offset: number): StatementRange | null {
  const stmts = splitStatements(sql);
  if (stmts.length === 0) return null;
  let current = stmts[0];
  for (const st of stmts) {
    const leading = st.text.length - st.text.trimStart().length;
    if (st.start + leading <= offset) current = st;
  }
  return current;
}
