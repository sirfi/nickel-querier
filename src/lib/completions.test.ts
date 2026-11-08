import { describe, it, expect } from "vitest";
import { buildSchemaSuggestions, extendForBacktick } from "./completions";

describe("buildSchemaSuggestions", () => {
  it("builds field and quoted keyspace items", () => {
    const s = buildSchemaSuggestions(
      [{ name: "geo.lat", field_type: "number" }],
      ["`travel-sample`.`inventory`.`airline`"]
    );
    expect(s[0]).toMatchObject({ kind: "field", insertText: "geo.lat", detail: "number" });
    expect(s[1]).toMatchObject({
      kind: "keyspace",
      label: "travel-sample.inventory.airline",
      insertText: "`travel-sample`.`inventory`.`airline`",
    });
  });
});

describe("extendForBacktick", () => {
  it("includes a preceding backtick in the range", () => {
    // "FROM `tra" — word "tra" spans columns 7..10, backtick at column 6
    expect(extendForBacktick("FROM `tra", 7, 10)).toEqual({ startColumn: 6, endColumn: 10 });
    expect(extendForBacktick("FROM tra", 6, 9)).toEqual({ startColumn: 6, endColumn: 9 });
  });

  it("also consumes the auto-closed backtick after the word", () => {
    expect(extendForBacktick("FROM `tra` x", 7, 10)).toEqual({ startColumn: 6, endColumn: 11 });
  });
});

describe("fieldReplaceStart", async () => {
  const { fieldReplaceStart } = await import("./completions");
  it("replaces the already typed part of a dotted field path", () => {
    // "d.geo.la" + suggestion "geo.lat" → replace from "geo"
    expect(fieldReplaceStart("d.geo.la", "geo.lat")).toBe(2);
    expect(fieldReplaceStart("geo.la", "geo.lat")).toBe(0);
  });
  it("falls back to the last word when the path does not match", () => {
    expect(fieldReplaceStart("d.la", "geo.lat")).toBe(2);
    expect(fieldReplaceStart("d.na", "name")).toBe(2);
    expect(fieldReplaceStart("d.", "name")).toBe(2);
  });

  it("extracts the typed path", async () => {
    const { typedPathBefore } = await import("./completions");
    expect(typedPathBefore("SELECT d.geo.la")).toBe("d.geo.la");
    expect(typedPathBefore("WHERE x = d.")).toBe("d.");
    expect(typedPathBefore("SELECT ")).toBe("");
  });
});
