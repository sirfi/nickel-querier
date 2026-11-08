import { describe, it, expect } from "vitest";
import { quoteIdentifier, keyspacePath, sampleQuery } from "./keyspace";

describe("keyspace helpers", () => {
  it("quotes each part of a collection path separately", () => {
    expect(keyspacePath({ bucket: "travel-sample", scope: "inventory", collection: "airline" }))
      .toBe("`travel-sample`.`inventory`.`airline`");
  });

  it("collapses the default collection to the bucket", () => {
    expect(keyspacePath({ bucket: "beer.sample", scope: "_default", collection: "_default" }))
      .toBe("`beer.sample`");
  });

  it("escapes backticks", () => {
    expect(quoteIdentifier("we`ird")).toBe("`we``ird`");
  });

  it("builds a sample query", () => {
    expect(sampleQuery({ bucket: "b", scope: "s", collection: "c" }, 5))
      .toBe("SELECT * FROM `b`.`s`.`c` LIMIT 5;");
  });
});
