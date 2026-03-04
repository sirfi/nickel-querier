// ============================================================
// Nickel Querier — N1QL / SQL++ Monaco Language Definition
// ============================================================
import type * as MonacoType from "monaco-editor";

const N1QL_KEYWORDS = [
  // DML
  "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "UPSERT", "DELETE", "MERGE",
  "INTO", "VALUES", "SET", "UNSET",
  // Clauses
  "AS", "ON", "USE", "KEYS", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "NEST",
  "UNNEST", "LET", "GROUP", "BY", "HAVING", "ORDER", "LIMIT", "OFFSET",
  "RETURNING", "WITH",
  // Logical
  "AND", "OR", "NOT", "IN", "WITHIN", "BETWEEN", "LIKE", "IS", "NULL", "MISSING",
  "TRUE", "FALSE", "VALUED",
  // Aggregates
  "COUNT", "SUM", "AVG", "MIN", "MAX", "STDDEV", "VARIANCE", "ARRAY_AGG",
  // String functions
  "CONCAT", "CONTAINS", "INITCAP", "LENGTH", "LOWER", "LTRIM", "POSITION",
  "REPEAT", "REPLACE", "RTRIM", "SPLIT", "SUBSTR", "TITLE", "TRIM", "UPPER",
  "REGEXP_CONTAINS", "REGEXP_LIKE", "REGEXP_POSITION", "REGEXP_REPLACE",
  // Numeric
  "ABS", "ACOS", "ASIN", "ATAN", "CEIL", "COS", "DEGREES", "EXP", "FLOOR",
  "LN", "LOG", "POWER", "RADIANS", "RANDOM", "ROUND", "SIGN", "SIN", "SQRT",
  "TAN", "TRUNC",
  // Date/time
  "CLOCK_MILLIS", "CLOCK_STR", "DATE_ADD_MILLIS", "DATE_ADD_STR", "DATE_DIFF_MILLIS",
  "DATE_DIFF_STR", "DATE_FORMAT_STR", "DATE_PART_MILLIS", "DATE_PART_STR",
  "DATE_RANGE_MILLIS", "DATE_RANGE_STR", "DATE_TRUNC_MILLIS", "DATE_TRUNC_STR",
  "MILLIS", "MILLIS_TO_STR", "MILLIS_TO_UTC", "NOW_MILLIS", "NOW_STR",
  "STR_TO_MILLIS", "STR_TO_UTC",
  // Type
  "TOARRAY", "TOATOM", "TOBOOLEAN", "TONUMBER", "TOOBJECT", "TOSTRING",
  "TYPE", "ISARRAY", "ISATOM", "ISBOOLEAN", "ISNUMBER", "ISOBJECT", "ISSTRING",
  // Array
  "ARRAY_APPEND", "ARRAY_AVG", "ARRAY_CONCAT", "ARRAY_CONTAINS", "ARRAY_COUNT",
  "ARRAY_DISTINCT", "ARRAY_FLATTEN", "ARRAY_IFNULL", "ARRAY_INSERT",
  "ARRAY_INTERSECT", "ARRAY_LENGTH", "ARRAY_MAX", "ARRAY_MIN", "ARRAY_POSITION",
  "ARRAY_PREPEND", "ARRAY_PUT", "ARRAY_RANGE", "ARRAY_REMOVE", "ARRAY_REPEAT",
  "ARRAY_REPLACE", "ARRAY_REVERSE", "ARRAY_SORT", "ARRAY_STAR", "ARRAY_SUM",
  "ARRAY_UNION",
  // Object
  "OBJECT_ADD", "OBJECT_CONCAT", "OBJECT_FIELD_NAME", "OBJECT_FIELD_NAMES",
  "OBJECT_INNER_JOIN", "OBJECT_INSERT", "OBJECT_LENGTH", "OBJECT_NAMES",
  "OBJECT_OUTER_JOIN", "OBJECT_PAIRS", "OBJECT_PUT", "OBJECT_REMOVE",
  "OBJECT_RENAME", "OBJECT_REPLACE", "OBJECT_TRIM", "OBJECT_UNWRAP",
  "OBJECT_VALUES",
  // Conditional
  "CASE", "WHEN", "THEN", "ELSE", "END", "IFMISSING", "IFMISSINGORNULL",
  "IFNULL", "MISSINGIF", "NULLIF", "NVL", "NVL2",
  // DDL / Admin
  "CREATE", "ALTER", "DROP", "BUILD", "INDEX", "PRIMARY", "USING", "GSI",
  "VIEW", "NAMESPACE", "KEYSPACE", "SCOPE", "COLLECTION", "BUCKET",
  "EXPLAIN", "ADVISE", "INFER",
  // Subquery / CTE
  "UNION", "ALL", "INTERSECT", "EXCEPT", "ANY", "EVERY", "EXISTS", "SOME",
  "SATISFIES", "WITHIN", "DISTINCT", "RAW", "ELEMENT", "VALUE", "META",
  // Misc
  "PREPARE", "EXECUTE", "TRANSACTION", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT",
];

const N1QL_SNIPPETS: MonacoType.languages.CompletionItem[] = [
  {
    label: "select-from",
    kind: 14, // Snippet
    insertText: "SELECT ${1:*}\nFROM `${2:bucket}` AS ${3:b}\nWHERE ${4:b.type = 'doc'}\nLIMIT ${5:100};",
    insertTextRules: 4, // InsertAsSnippet
    documentation: "Basic SELECT statement",
    detail: "N1QL snippet",
    sortText: "0",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "select-meta",
    kind: 14,
    insertText: "SELECT META().id, META().cas, ${1:b}.*\nFROM `${2:bucket}` AS ${3:b}\nLIMIT ${4:10};",
    insertTextRules: 4,
    documentation: "SELECT with document metadata",
    detail: "N1QL snippet",
    sortText: "0",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "index-primary",
    kind: 14,
    insertText: "CREATE PRIMARY INDEX ON `${1:bucket}`;",
    insertTextRules: 4,
    documentation: "Create a primary index",
    detail: "N1QL snippet",
    sortText: "1",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "index-secondary",
    kind: 14,
    insertText: "CREATE INDEX idx_${1:name} ON `${2:bucket}`(${3:field});",
    insertTextRules: 4,
    documentation: "Create a secondary GSI index",
    detail: "N1QL snippet",
    sortText: "1",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "upsert-doc",
    kind: 14,
    insertText: "UPSERT INTO `${1:bucket}` (KEY, VALUE)\n  VALUES (\"${2:doc_key}\", {\n    \"type\": \"${3:docType}\",\n    ${4:}\n  });",
    insertTextRules: 4,
    documentation: "UPSERT a document",
    detail: "N1QL snippet",
    sortText: "1",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "update-where",
    kind: 14,
    insertText: "UPDATE `${1:bucket}` AS b\nSET b.${2:field} = ${3:value}\nWHERE ${4:b.type = 'doc'}\nRETURNING META().id;",
    insertTextRules: 4,
    documentation: "UPDATE documents matching a filter",
    detail: "N1QL snippet",
    sortText: "1",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "delete-where",
    kind: 14,
    insertText: "DELETE FROM `${1:bucket}` AS b\nWHERE ${2:b.type = 'doc'}\nRETURNING META().id;",
    insertTextRules: 4,
    documentation: "DELETE documents matching a filter",
    detail: "N1QL snippet",
    sortText: "1",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "explain",
    kind: 14,
    insertText: "EXPLAIN SELECT ${1:*}\nFROM `${2:bucket}`\nWHERE ${3:type = 'doc'};",
    insertTextRules: 4,
    documentation: "EXPLAIN query plan",
    detail: "N1QL snippet",
    sortText: "0",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "array-comprehension",
    kind: 14,
    insertText: "ARRAY v FOR v IN ${1:array_field} WHEN ${2:v > 0} END",
    insertTextRules: 4,
    documentation: "Array comprehension expression",
    detail: "N1QL snippet",
    sortText: "2",
  } as unknown as MonacoType.languages.CompletionItem,
  {
    label: "let",
    kind: 14,
    insertText: "LET ${1:alias} = ${2:expression}",
    insertTextRules: 4,
    documentation: "LET clause — bind variable",
    detail: "N1QL snippet",
    sortText: "2",
  } as unknown as MonacoType.languages.CompletionItem,
];

export function registerN1QLLanguage(monaco: typeof MonacoType): void {
  // Register only if not already registered
  if (monaco.languages.getLanguages().some((l) => l.id === "n1ql")) return;

  monaco.languages.register({ id: "n1ql", aliases: ["N1QL", "SQL++"] });

  monaco.languages.setMonarchTokensProvider("n1ql", {
    keywords: N1QL_KEYWORDS,
    tokenizer: {
      root: [
        // Comments
        [/--.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        // Strings
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        // Backtick identifiers
        [/`[^`]*`/, "identifier"],
        // Numbers
        [/\b\d+(\.\d+)?([eE][+-]?\d+)?\b/, "number"],
        // Operators
        [/[=<>!]=?|&&|\|\||[+\-*/%]/, "operator"],
        // Punctuation
        [/[(),;.]/, "delimiter"],
        // Keywords
        [
          /\b([A-Za-z_$][\w$]*)\b/,
          {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        // Parameters ($1, $name)
        [/\$[\w]+/, "variable"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  } as MonacoType.languages.IMonarchLanguage);

  monaco.languages.setLanguageConfiguration("n1ql", {
    comments: {
      lineComment: "--",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "`", close: "`" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "`", close: "`" },
    ],
    folding: {
      markers: {
        start: /^\s*--\s*#region\b/,
        end: /^\s*--\s*#endregion\b/,
      },
    },
  });

  monaco.languages.registerCompletionItemProvider("n1ql", {
    provideCompletionItems(
      _model: MonacoType.editor.ITextModel,
      _position: MonacoType.Position,
      _context: MonacoType.languages.CompletionContext,
      _token: MonacoType.CancellationToken
    ): MonacoType.languages.ProviderResult<MonacoType.languages.CompletionList> {
      const keywordItems: MonacoType.languages.CompletionItem[] =
        N1QL_KEYWORDS.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          detail: "keyword",
          sortText: "3" + kw,
          range: new monaco.Range(0, 0, 0, 0),
        }));

      return {
        suggestions: [
          ...N1QL_SNIPPETS.map((s) => ({
            ...s,
            range: new monaco.Range(0, 0, 0, 0),
          })),
          ...keywordItems,
        ],
      };
    },
  });

  // Dark theme that matches the app palette
  monaco.editor.defineTheme("nickel-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword",    foreground: "ff7b72", fontStyle: "bold" },
      { token: "identifier", foreground: "e6edf3" },
      { token: "string",     foreground: "a5d6ff" },
      { token: "number",     foreground: "79c0ff" },
      { token: "comment",    foreground: "8b949e", fontStyle: "italic" },
      { token: "operator",   foreground: "ff7b72" },
      { token: "variable",   foreground: "ffa657" },
      { token: "delimiter",  foreground: "e6edf3" },
    ],
    colors: {
      "editor.background":           "#0d1117",
      "editor.foreground":           "#e6edf3",
      "editorLineNumber.foreground": "#484f58",
      "editorCursor.foreground":     "#58a6ff",
      "editor.selectionBackground":  "#1f6feb55",
      "editor.lineHighlightBackground": "#161b22",
      "editorIndentGuide.background1": "#21262d",
      "editorWidget.background":     "#161b22",
      "editorSuggestWidget.background": "#161b22",
      "editorSuggestWidget.border":  "#30363d",
    },
  });
}

export { N1QL_KEYWORDS, N1QL_SNIPPETS };
