// ============================================================
// Nickel Querier — Shareable query links
// ============================================================
//
// Format: nickelquerier://query?v=1&d=<base64url(JSON)>
// The JSON holds only the query itself (never connection details or
// parameter values). The scheme is ready for OS deep-link registration.

export const SHARE_SCHEME = "nickelquerier";
const MAX_LINK_LENGTH = 64 * 1024;

export interface SharedQuery {
  name: string;
  statement: string;
  tags: string[];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShareLink(q: SharedQuery): string {
  const payload = JSON.stringify({ n: q.name, s: q.statement, t: q.tags });
  return `${SHARE_SCHEME}://query?v=1&d=${toBase64Url(payload)}`;
}

/** Parse a share link (surrounding whitespace / quotes are ignored). Throws with a readable message. */
export function decodeShareLink(input: string): SharedQuery {
  const text = input.trim().replace(/^["'<]+|[">']+$/g, "");
  if (text.length > MAX_LINK_LENGTH) throw new Error("The link is too long");
  const m = /^nickelquerier:\/\/query\?(.*)$/i.exec(text);
  if (!m) throw new Error("Not a Nickel Querier link (expected nickelquerier://query?…)");
  const params = new URLSearchParams(m[1]);
  const version = params.get("v") ?? "1";
  if (version !== "1") throw new Error(`Unsupported link version ${version} — update Nickel Querier`);
  const data = params.get("d");
  if (!data) throw new Error("The link has no query data");

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(data));
  } catch {
    throw new Error("The link is damaged (could not decode the query)");
  }
  const o = parsed as { n?: unknown; s?: unknown; t?: unknown };
  if (typeof o?.s !== "string" || !o.s.trim()) throw new Error("The link does not contain a query");
  return {
    name: typeof o.n === "string" && o.n.trim() ? o.n : "Shared query",
    statement: o.s,
    tags: Array.isArray(o.t) ? o.t.filter((x): x is string => typeof x === "string") : [],
  };
}
