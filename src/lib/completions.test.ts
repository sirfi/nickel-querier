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
    // "FROM `tra" — word "tra" starts at column 7, backtick at column 6
    expect(extendForBacktick("FROM `tra", 7)).toBe(6);
    expect(extendForBacktick("FROM tra", 6)).toBe(6);
  });
});
