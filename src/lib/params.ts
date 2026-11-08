// ============================================================
// Nickel Querier — Query parameter helpers
// ============================================================
import { tokenize } from "./n1ql-formatter";

export interface DetectedParams {
  /** Positional parameter numbers ($1, $2 …), sorted, unique */
  positional: number[];
  /** Named parameters without the `$` ($city → "city"), in first-seen order */
  named: string[];
}

/**
 * Find `$1` / `$name` parameters in a statement. Text inside strings,
 * backtick identifiers and comments is ignored.
 */
export function detectParameters(sql: string): DetectedParams {
  const positional = new Set<number>();
  const named: string[] = [];
  for (const tok of tokenize(sql)) {
    if (tok.type !== "param" || tok.text.length < 2) continue;
    const name = tok.text.slice(1);
    if (/^\d+$/.test(name)) positional.add(Number(name));
    else if (!named.includes(name)) named.push(name);
  }
  return { positional: [...positional].sort((a, b) => a - b), named };
}

/** Key used to store a parameter's value: "$1" or "$name". */
export function paramKey(p: number | string): string {
  return `$${p}`;
}

export function detectedKeys(d: DetectedParams): string[] {
  return [...d.positional.map(paramKey), ...d.named.map(paramKey)];
}

/**
 * Interpret an input value: valid JSON (numbers, true/false/null, "quoted",
 * arrays, objects) is used as-is; anything else is sent as a plain string.
 */
export function parseParamValue(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return "";
  try {
    return JSON.parse(t);
  } catch {
    return raw;
  }
}

export type BuiltParams =
  | { ok: true; parameters?: unknown[]; named_parameters?: Record<string, unknown> }
  | { ok: false; error: string };

/** Build the request parameters for a statement from the user's input values. */
export function buildParams(sql: string, values: Record<string, string>): BuiltParams {
  const d = detectParameters(sql);
  const missing = detectedKeys(d).filter((k) => (values[k] ?? "").trim() === "");
  if (missing.length > 0) {
    return { ok: false, error: `Missing value for parameter ${missing.join(", ")}` };
  }
  const result: BuiltParams = { ok: true };
  if (d.positional.length > 0) {
    const max = d.positional[d.positional.length - 1];
    const gaps = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !d.positional.includes(n));
    if (gaps.length > 0) {
      return { ok: false, error: `Positional parameters must be consecutive: missing ${gaps.map(paramKey).join(", ")}` };
    }
    result.parameters = d.positional.map((n) => parseParamValue(values[paramKey(n)]));
  }
  if (d.named.length > 0) {
    result.named_parameters = Object.fromEntries(
      d.named.map((n) => [n, parseParamValue(values[paramKey(n)])])
    );
  }
  return result;
}
