// ============================================================
// Nickel Querier — N1QL / SQL++ Formatter (token based)
// ============================================================
//
// The formatter tokenizes the input first so that string literals,
// quoted identifiers and comments are never modified, and so that
// field names (e.g. `d.first`, `d.key`) are not mistaken for keywords.

/** Major clauses that start on a new line. Longest variants first. */
const CLAUSES: string[][] = [
  ["LEFT", "OUTER", "JOIN"],
  ["RIGHT", "OUTER", "JOIN"],
  ["FULL", "OUTER", "JOIN"],
  ["CREATE", "PRIMARY", "INDEX"],
  ["WHEN", "NOT", "MATCHED"],
  ["GROUP", "BY"],
  ["ORDER", "BY"],
  ["LEFT", "JOIN"],
  ["RIGHT", "JOIN"],
  ["INNER", "JOIN"],
  ["OUTER", "JOIN"],
  ["FULL", "JOIN"],
  ["CROSS", "JOIN"],
  ["LEFT", "NEST"],
  ["INNER", "NEST"],
  ["LEFT", "UNNEST"],
  ["INNER", "UNNEST"],
  ["INSERT", "INTO"],
  ["UPSERT", "INTO"],
  ["DELETE", "FROM"],
  ["MERGE", "INTO"],
  ["WHEN", "MATCHED"],
  ["UNION", "ALL"],
  ["INTERSECT", "ALL"],
  ["EXCEPT", "ALL"],
  ["CREATE", "INDEX"],
  ["BUILD", "INDEX"],
  ["DROP", "INDEX"],
  ["ALTER", "INDEX"],
  ["USE", "KEYS"],
  ["USE", "INDEX"],
  ["SELECT"],
  ["FROM"],
  ["WHERE"],
  ["HAVING"],
  ["LIMIT"],
  ["OFFSET"],
  ["JOIN"],
  ["UNNEST"],
  ["NEST"],
  ["LET"],
  ["LETTING"],
  ["VALUES"],
  ["UPDATE"],
  ["SET"],
  ["UNSET"],
  ["UNION"],
  ["INTERSECT"],
  ["EXCEPT"],
  ["RETURNING"],
  ["EXPLAIN"],
  ["ADVISE"],
  ["INFER"],
  ["WITH"],
];

/** Keywords that are uppercased (but do not start a new line on their own). */
const KEYWORDS = new Set(
  [
    ...CLAUSES.flat(),
    "AND", "OR", "NOT", "IN", "IS", "NULL", "MISSING", "VALUED", "LIKE",
    "BETWEEN", "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END", "AS", "ON",
    "KEYS", "KEY", "VALUE", "INDEX", "PRIMARY", "DISTINCT", "ALL", "ANY",
    "EVERY", "SOME", "SATISFIES", "ASC", "DESC", "NULLS", "FIRST", "LAST",
    "TRUE", "FALSE", "ARRAY", "OBJECT", "WITHIN", "RAW", "ELEMENT", "FOR",
    "INTO", "BY", "USING", "GSI", "FTS", "IF", "DELETE", "INSERT", "UPSERT",
    "MERGE", "CREATE", "DROP", "ALTER", "BUILD", "PREPARE", "EXECUTE",
    "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "WORK", "SAVEPOINT",
    "MATCHED", "INNER", "LEFT", "RIGHT", "OUTER", "CROSS", "FULL", "USE",
    "UNDER", "OVER", "PARTITION", "RECURSIVE", "SCOPE", "COLLECTION",
    "BUCKET", "NAMESPACE", "DEFERRED", "BEFORE", "AFTER", "WINDOW",
  ].map((k) => k.toUpperCase())
);

export type TokenType =
  | "ws"
  | "comment"
  | "string"
  | "ident" // backtick quoted identifier
  | "word"
  | "number"
  | "param"
  | "punct";

export interface Token {
  type: TokenType;
  text: string;
}

/** Splits a statement into tokens. Unterminated literals run to the end. */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = sql.length;

  const readQuoted = (quote: string): string => {
    let j = i + 1;
    while (j < n) {
      const c = sql[j];
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === quote) {
        // Doubled quote ('' or ``) is an escaped quote
        if (sql[j + 1] === quote) {
          j += 2;
          continue;
        }
        return sql.slice(i, j + 1);
      }
      j++;
    }
    return sql.slice(i);
  };

  while (i < n) {
    const c = sql[i];
    const rest2 = sql.slice(i, i + 2);
    let text: string;
    let type: TokenType;

    if (/\s/.test(c)) {
      const m = /^\s+/.exec(sql.slice(i))!;
      text = m[0];
      type = "ws";
    } else if (rest2 === "--") {
      const end = sql.indexOf("\n", i);
      text = end === -1 ? sql.slice(i) : sql.slice(i, end);
      type = "comment";
    } else if (rest2 === "/*") {
      const end = sql.indexOf("*/", i + 2);
      text = end === -1 ? sql.slice(i) : sql.slice(i, end + 2);
      type = "comment";
    } else if (c === "'" || c === '"') {
      text = readQuoted(c);
      type = "string";
    } else if (c === "`") {
      text = readQuoted(c);
      type = "ident";
    } else if (c === "$") {
      const m = /^\$[\w]*/.exec(sql.slice(i))!;
      text = m[0];
      type = "param";
    } else if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(sql.slice(i))!;
      text = m[0];
      type = "number";
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][\w$]*/.exec(sql.slice(i))!;
      text = m[0];
      type = "word";
    } else {
      // Multi-char operators are kept together for nicer output
      const m = /^(<=|>=|!=|<>|==|\|\|)/.exec(sql.slice(i));
      text = m ? m[0] : c;
      type = "punct";
    }
    tokens.push({ type, text });
    i += text.length;
  }
  return tokens;
}

/**
 * Formats a N1QL / SQL++ statement:
 * - Uppercases keywords (never field names after `.` or object keys before `:`)
 * - Starts each major clause on its own line
 * - Indents clauses inside parentheses (sub-queries)
 * - Leaves string literals, quoted identifiers and comments untouched
 */
export function formatN1QL(input: string): string {
  if (!input.trim()) return input;

  // Drop whitespace; we re-create it. Comments are preserved.
  const tokens = tokenize(input);
  const sig: Token[] = [];
  const newlineBefore: boolean[] = []; // original newline before a comment
  let sawNewline = false;
  for (const t of tokens) {
    if (t.type === "ws") {
      if (t.text.includes("\n")) sawNewline = true;
      continue;
    }
    sig.push(t);
    newlineBefore.push(sawNewline);
    sawNewline = false;
  }

  const isWord = (idx: number, w: string) =>
    sig[idx]?.type === "word" && sig[idx].text.toUpperCase() === w;

  /** Nearest token before / after `idx`, skipping comments. */
  const neighbour = (idx: number, step: -1 | 1): Token | undefined => {
    let i = idx + step;
    while (sig[i]?.type === "comment") i += step;
    return sig[i];
  };

  const isPropertyAccess = (idx: number) => {
    const prev = neighbour(idx, -1);
    const next = neighbour(idx, 1);
    return (prev?.type === "punct" && prev.text === ".") ||
      (next?.type === "punct" && next.text === ":");
  };

  // Whitespace we generate is always " " or "\n" + indentation; tokens never
  // are (whitespace tokens are dropped), so these can be trimmed safely
  // without touching literals, quoted identifiers or comments.
  const isGeneratedSpace = (piece: string | undefined) => piece === " ";
  const isGeneratedBreak = (piece: string | undefined) => piece !== undefined && /^\n *$/.test(piece);

  const out: string[] = [];
  let depth = 0;
  let lineStart = true;

  const indent = () => "  ".repeat(Math.max(0, depth));
  const newline = () => {
    while (isGeneratedSpace(out[out.length - 1])) out.pop();
    // A previous break followed by nothing: drop its indentation (blank line)
    if (isGeneratedBreak(out[out.length - 1])) out[out.length - 1] = "\n";
    if (out.length) out.push("\n" + indent());
    lineStart = true;
  };

  const needsSpace = (prev: Token | undefined, cur: Token): boolean => {
    if (!prev || lineStart) return false;
    if (cur.type === "punct") {
      if ([",", ";", ")", "]", ".", ":"].includes(cur.text)) return false;
      if ((cur.text === "(" || cur.text === "[") &&
        (prev.type === "word" || prev.type === "ident" || prev.text === ")" || prev.text === "]")) {
        // function call / array index: no space, unless the word is a keyword like IN / AND
        if (prev.type === "word" && KEYWORDS.has(prev.text.toUpperCase())) return true;
        return false;
      }
    }
    if (prev.type === "punct" && ["(", "[", "."].includes(prev.text)) return false;
    return true;
  };

  let prevTok: Token | undefined;
  for (let i = 0; i < sig.length; i++) {
    const tok = sig[i];

    if (tok.type === "comment") {
      if (newlineBefore[i] && i > 0) newline();
      else if (!lineStart) out.push(" ");
      out.push(tok.text);
      prevTok = tok;
      lineStart = false;
      if (tok.text.startsWith("--")) newline();
      continue;
    }

    // Clause detection (only on real keywords, not field names)
    let clauseLen = 0;
    if (tok.type === "word" && !isPropertyAccess(i)) {
      for (const clause of CLAUSES) {
        if (clause.every((w, k) => isWord(i + k, w))) {
          clauseLen = clause.length;
          break;
        }
      }
    }

    if (clauseLen > 0) {
      const prevSig = sig[i - 1];
      const afterOpenParen = prevSig?.type === "punct" && prevSig.text === "(";
      // `SET` inside `UPDATE … SET` is a clause, but in `ON KEY … SET` etc. still fine.
      if (i > 0 && !lineStart && !afterOpenParen) newline();
      if (afterOpenParen) {
        // sub-query: put it on its own indented line
        newline();
      }
      for (let k = 0; k < clauseLen; k++) {
        const w = sig[i + k];
        if (needsSpace(prevTok, w)) out.push(" ");
        out.push(w.text.toUpperCase());
        prevTok = w;
        lineStart = false;
      }
      i += clauseLen - 1;
      continue;
    }

    if (tok.type === "punct" && tok.text === "(") {
      if (needsSpace(prevTok, tok)) out.push(" ");
      out.push("(");
      depth++;
      prevTok = tok;
      lineStart = false;
      continue;
    }
    if (tok.type === "punct" && tok.text === ")") {
      depth--;
      out.push(")");
      prevTok = tok;
      lineStart = false;
      continue;
    }
    if (tok.type === "punct" && tok.text === ";") {
      out.push(";");
      prevTok = tok;
      if (i < sig.length - 1) {
        depth = 0;
        out.push("\n");
        newline();
      }
      continue;
    }

    let text = tok.text;
    if (tok.type === "word" && KEYWORDS.has(text.toUpperCase()) && !isPropertyAccess(i)) {
      text = text.toUpperCase();
    }
    if (needsSpace(prevTok, tok)) out.push(" ");
    out.push(text);
    prevTok = tok;
    lineStart = false;
  }

  while (out.length && /^\s+$/.test(out[out.length - 1])) out.pop();
  return out.join("");
}
