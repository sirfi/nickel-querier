// ============================================================
// Nickel Querier — Result table helpers (pure, unit tested)
// ============================================================

export type Row = Record<string, unknown>;
export type SortDirection = "asc" | "desc";

/** Column name used when a query returns non-object rows (e.g. SELECT RAW). */
export const RAW_VALUE_COLUMN = "$value";

function isPlainObject(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Normalise query results into table rows. Objects stay as they are;
 * primitives / arrays (from `SELECT RAW …`) are wrapped in `{ $value }`.
 */
export function toRows(results: unknown[]): Row[] {
  return results.map((r) => (isPlainObject(r) ? r : { [RAW_VALUE_COLUMN]: r }));
}

/** Union of keys over all rows, in first-seen order. */
export function collectColumns(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) seen.add(k);
  }
  return [...seen];
}

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function filterRows(rows: Row[], text: string): Row[] {
  const needle = text.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    Object.values(row).some((v) => cellToString(v).toLowerCase().includes(needle))
  );
}

/** Ordering rank so that MISSING < null < booleans < numbers < strings < objects. */
function typeRank(v: unknown): number {
  if (v === undefined) return 0;
  if (v === null) return 1;
  switch (typeof v) {
    case "boolean": return 2;
    case "number": return 3;
    case "string": return 4;
    default: return 5;
  }
}

export function compareValues(a: unknown, b: unknown): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return cellToString(a).localeCompare(cellToString(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortRows(rows: Row[], column: string | null, dir: SortDirection): Row[] {
  if (!column) return rows;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareValues(a[column], b[column]));
}

function csvEscape(v: unknown): string {
  const s = cellToString(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[], columns: string[]): string {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(","));
  return [header, ...body].join("\n");
}

/** Tab separated — pastes cleanly into spreadsheets. */
export function toTsv(rows: Row[], columns: string[]): string {
  const clean = (v: unknown) => cellToString(v).replace(/[\t\n\r]+/g, " ");
  return [
    columns.map(clean).join("\t"),
    ...rows.map((r) => columns.map((c) => clean(r[c])).join("\t")),
  ].join("\n");
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
