import { describe, it, expect } from "vitest";
import { detectParameters, parseParamValue, buildParams } from "./params";

describe("detectParameters", () => {
  it("finds positional and named parameters", () => {
    expect(detectParameters("SELECT * FROM b WHERE a = $2 AND b = $1 AND c = $city AND d = $city"))
      .toEqual({ positional: [1, 2], named: ["city"] });
  });

  it("ignores parameters in strings, identifiers and comments", () => {
    expect(detectParameters("SELECT '$x', `$y` -- $z\n/* $w */ FROM b"))
      .toEqual({ positional: [], named: [] });
  });
});

describe("parseParamValue", () => {
  it("parses JSON and falls back to strings", () => {
    expect(parseParamValue("42")).toBe(42);
    expect(parseParamValue("true")).toBe(true);
    expect(parseParamValue('"42"')).toBe("42");
    expect(parseParamValue("[1,2]")).toEqual([1, 2]);
    expect(parseParamValue("Paris")).toBe("Paris");
  });
});

describe("buildParams", () => {
  it("builds positional args and named parameters", () => {
    expect(buildParams("SELECT $1, $2, $city", { $1: "1", $2: "x", $city: '"Paris"' })).toEqual({
      ok: true,
      parameters: [1, "x"],
      named_parameters: { city: "Paris" },
    });
  });

  it("returns nothing extra when there are no parameters", () => {
    expect(buildParams("SELECT 1", {})).toEqual({ ok: true });
  });

  it("reports missing values", () => {
    const r = buildParams("SELECT $a, $b", { $a: "1" });
    expect(r).toEqual({ ok: false, error: "Missing value for parameter $b" });
  });

  it("reports gaps in positional parameters", () => {
    const r = buildParams("SELECT $2", { $2: "1" });
    expect(r.ok).toBe(false);
  });
});
