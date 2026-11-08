import { describe, it, expect } from "vitest";
import { getDocumentQuery, upsertDocumentQuery, deleteDocumentQuery, parseJsonDocument } from "./documents";

const ks = { bucket: "travel-sample", scope: "inventory", collection: "airline" };

describe("document queries", () => {
  it("passes the key as a parameter (never interpolated)", () => {
    const q = getDocumentQuery(ks, "airline_10'; DROP");
    expect(q.statement).toBe("SELECT META(d).cas AS cas, d AS doc FROM `travel-sample`.`inventory`.`airline` AS d USE KEYS $1");
    expect(q.parameters).toEqual(["airline_10'; DROP"]);
  });

  it("upserts and deletes by key", () => {
    expect(upsertDocumentQuery(ks, "k", { a: 1 }).parameters).toEqual(["k", { a: 1 }]);
    expect(deleteDocumentQuery(ks, "k").statement).toContain("USE KEYS $1");
  });
});

describe("parseJsonDocument", () => {
  it("accepts objects and rejects invalid JSON or scalars", () => {
    expect(parseJsonDocument('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonDocument("{a:1}").ok).toBe(false);
    expect(parseJsonDocument("42").ok).toBe(false);
  });
});
