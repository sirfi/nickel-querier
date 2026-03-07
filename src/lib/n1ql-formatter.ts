// ============================================================
// Nickel Querier — Simple N1QL / SQL++ Formatter
// ============================================================

/** Major clause keywords that each start on a new line with no indent. */
const CLAUSE_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "OUTER JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "UNNEST",
  "NEST",
  "LET",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "UNSET",
  "DELETE FROM",
  "MERGE INTO",
  "WHEN MATCHED",
  "WHEN NOT MATCHED",
  "UNION",
  "UNION ALL",
  "INTERSECT",
  "EXCEPT",
  "RETURNING",
  "CREATE INDEX",
  "CREATE PRIMARY INDEX",
  "BUILD INDEX",
  "DROP INDEX",
  "ALTER INDEX",
  "EXPLAIN",
  "ADVISE",
  "INFER",
  "USE KEYS",
  "USE INDEX",
];

/** All N1QL / SQL++ keywords to be uppercased. */
const ALL_KEYWORDS = [
  ...CLAUSE_KEYWORDS,
  "AND",
  "OR",
  "NOT",
  "IN",
  "NOT IN",
  "IS",
  "IS NOT",
  "IS NULL",
  "IS NOT NULL",
  "IS MISSING",
  "IS NOT MISSING",
  "IS VALUED",
  "LIKE",
  "NOT LIKE",
  "BETWEEN",
  "EXISTS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "AS",
  "ON",
  "KEYS",
  "KEY",
  "INDEX",
  "PRIMARY",
  "DISTINCT",
  "ALL",
  "ANY",
  "EVERY",
  "SATISFIES",
  "ASC",
  "DESC",
  "NULLS FIRST",
  "NULLS LAST",
  "TRUE",
  "FALSE",
  "NULL",
  "MISSING",
  "ARRAY",
  "FIRST",
  "OBJECT",
  "WITH",
  "WITHIN",
  "RAW",
  "ELEMENT",
  "IF",
  "IFNULL",
  "IFMISSING",
  "IFMISSINGORNULL",
  "NVL",
  "COALESCE",
];

/**
 * Extracts string literals (single-quoted, double-quoted, backtick-quoted)
 * from `sql`, replaces them with numeric placeholders, and returns the
 * sanitised SQL along with the original literal values.
 */
function extractLiterals(sql: string): { sanitised: string; literals: string[] } {
  const literals: string[] = [];
  // Match: single-quoted, double-quoted, or backtick-quoted (with escape sequences)
  const literalRe = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
  const sanitised = sql.replace(literalRe, (match) => {
    literals.push(match);
    return `\x00LIT${literals.length - 1}\x00`;
  });
  return { sanitised, literals };
}

/** Restores the extracted literals back into the formatted SQL. */
function restoreLiterals(sql: string, literals: string[]): string {
  return sql.replace(/\x00LIT(\d+)\x00/g, (_, idx) => literals[Number(idx)]);
}

/**
 * Formats a N1QL / SQL++ statement:
 * - Uppercases keywords
 * - Puts each major clause on its own line
 * - Indents continuation lines
 */
export function formatN1QL(input: string): string {
  if (!input.trim()) return input;

  let sql = input.trim();

  // Extract literals so we don't accidentally modify their contents
  const { sanitised, literals } = extractLiterals(sql);
  sql = sanitised;

  // Uppercase all keywords (word-boundary aware, case-insensitive)
  // Sort by length descending to match multi-word keywords first
  const sortedKeywords = [...ALL_KEYWORDS].sort((a, b) => b.length - a.length);
  for (const kw of sortedKeywords) {
    const escaped = kw.replace(/ /g, "\\s+");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    sql = sql.replace(re, kw);
  }

  // Insert newlines before major clause keywords
  const clauseSorted = [...CLAUSE_KEYWORDS].sort((a, b) => b.length - a.length);
  for (const kw of clauseSorted) {
    const escaped = kw.replace(/ /g, "\\s+");
    // Replace whitespace-before-keyword with newline, but only when not already preceded by a newline.
    // We split on newlines and re-join to avoid lookbehind assertions.
    sql = sql
      .split("\n")
      .map((line) => line.replace(new RegExp(`\\s+\\b(${escaped})\\b`, "g"), `\n$1`))
      .join("\n");
  }

  // Clean up multiple blank lines
  sql = sql.replace(/\n{3,}/g, "\n\n");

  // Indent lines that are not clause starters (continuation lines get 2 spaces)
  const lines = sql.split("\n");
  const formatted = lines.map((line, i) => {
    if (i === 0) return line;
    const trimmed = line.trimStart();
    const isClause = clauseSorted.some((kw) =>
      new RegExp(`^${kw.replace(/ /g, "\\s+")}(\\s|$)`, "i").test(trimmed)
    );
    if (isClause) return trimmed;
    return trimmed ? "  " + trimmed : "";
  });

  // Restore string literals
  return restoreLiterals(formatted.join("\n"), literals);
}
