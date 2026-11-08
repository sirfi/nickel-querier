// ============================================================
// Nickel Querier — Saved query folders & tags (pure helpers)
// ============================================================
import { SavedQuery } from "./types";

/** "  a / b//c " → "a/b/c" (empty string = root) */
export function normalizeFolder(path: string | undefined): string {
  return (path ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export function parentFolder(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function folderName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** True when `path` is `folder` itself or inside it. */
export function isInFolder(path: string, folder: string): boolean {
  return folder === "" || path === folder || path.startsWith(folder + "/");
}

/** Move `path` from under `from` to under `to` (used for rename / delete / drag of folders). */
export function rebaseFolder(path: string, from: string, to: string): string {
  if (!isInFolder(path, from) || from === "") return path;
  return normalizeFolder(to + path.slice(from.length));
}

export interface FolderNode {
  path: string;
  name: string;
  folders: FolderNode[];
  queries: SavedQuery[];
  /** Queries in this folder and all sub-folders */
  total: number;
}

/** Nested folder tree from query folder paths plus explicitly created (possibly empty) folders. */
export function buildFolderTree(queries: SavedQuery[], explicitFolders: string[] = []): FolderNode {
  const root: FolderNode = { path: "", name: "", folders: [], queries: [], total: 0 };
  const nodes = new Map<string, FolderNode>([["", root]]);

  const ensure = (path: string): FolderNode => {
    const existing = nodes.get(path);
    if (existing) return existing;
    const parent = ensure(parentFolder(path));
    const node: FolderNode = { path, name: folderName(path), folders: [], queries: [], total: 0 };
    parent.folders.push(node);
    nodes.set(path, node);
    return node;
  };

  for (const f of explicitFolders) {
    const p = normalizeFolder(f);
    if (p) ensure(p);
  }
  for (const q of queries) ensure(normalizeFolder(q.folder)).queries.push(q);

  const finish = (n: FolderNode): number => {
    n.folders.sort((a, b) => a.name.localeCompare(b.name));
    n.queries.sort((a, b) => a.name.localeCompare(b.name));
    n.total = n.queries.length + n.folders.reduce((sum, f) => sum + finish(f), 0);
    return n.total;
  };
  finish(root);
  return root;
}

export function allFolderPaths(tree: FolderNode): string[] {
  const out: string[] = [];
  const walk = (n: FolderNode) => {
    if (n.path) out.push(n.path);
    n.folders.forEach(walk);
  };
  walk(tree);
  return out;
}

/** Tags with their usage count, most used first. */
export function tagCounts(queries: SavedQuery[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const q of queries) for (const t of q.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
