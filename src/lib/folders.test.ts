import { describe, it, expect } from "vitest";
import {
  normalizeFolder, parentFolder, rebaseFolder, buildFolderTree, allFolderPaths, tagCounts, isInFolder,
} from "./folders";
import type { SavedQuery } from "./types";

const q = (name: string, folder?: string, tags: string[] = []): SavedQuery => ({
  id: name, name, statement: "SELECT 1", created_at: "2026-01-01T00:00:00Z", tags, folder,
});

describe("folder paths", () => {
  it("normalises separators and whitespace", () => {
    expect(normalizeFolder(" Reports / Daily// ")).toBe("Reports/Daily");
    expect(normalizeFolder(undefined)).toBe("");
  });

  it("finds parents and membership", () => {
    expect(parentFolder("a/b/c")).toBe("a/b");
    expect(parentFolder("a")).toBe("");
    expect(isInFolder("a/b", "a")).toBe(true);
    expect(isInFolder("ab", "a")).toBe(false);
  });

  it("rebases a folder and its children", () => {
    expect(rebaseFolder("Reports/Daily", "Reports", "Archive/Reports")).toBe("Archive/Reports/Daily");
    expect(rebaseFolder("Reports", "Reports", "")).toBe(""); // delete → contents move to parent
    expect(rebaseFolder("Other", "Reports", "X")).toBe("Other");
  });
});

describe("buildFolderTree", () => {
  it("nests folders, includes empty explicit folders and counts recursively", () => {
    const tree = buildFolderTree([q("root q"), q("daily", "Reports/Daily"), q("weekly", "Reports")], ["Empty"]);
    expect(tree.queries.map((x) => x.name)).toEqual(["root q"]);
    expect(tree.folders.map((f) => f.name)).toEqual(["Empty", "Reports"]);
    const reports = tree.folders[1];
    expect(reports.total).toBe(2);
    expect(reports.folders[0].path).toBe("Reports/Daily");
    expect(tree.total).toBe(3);
    expect(allFolderPaths(tree)).toEqual(["Empty", "Reports", "Reports/Daily"]);
  });
});

describe("tagCounts", () => {
  it("counts and sorts tags", () => {
    expect(tagCounts([q("a", "", ["x", "y"]), q("b", "", ["y"])])).toEqual([["y", 2], ["x", 1]]);
  });
});
