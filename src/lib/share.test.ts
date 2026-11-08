import { describe, it, expect } from "vitest";
import { encodeShareLink, decodeShareLink } from "./share";

describe("share links", () => {
  const q = { name: "Hotels in Paris — şehir", statement: "SELECT * FROM `travel-sample` WHERE city = $city /* é */", tags: ["demo"] };

  it("round-trips unicode, backticks and comments", () => {
    const link = encodeShareLink(q);
    expect(link).toMatch(/^nickelquerier:\/\/query\?v=1&d=[A-Za-z0-9_-]+$/);
    expect(decodeShareLink(link)).toEqual(q);
  });

  it("tolerates surrounding whitespace and quotes", () => {
    expect(decodeShareLink(`  "${encodeShareLink(q)}"\n`)).toEqual(q);
  });

  it("rejects other links, damaged data and empty queries", () => {
    expect(() => decodeShareLink("https://example.com")).toThrow("Not a Nickel Querier link");
    expect(() => decodeShareLink("nickelquerier://query?v=1&d=!!!")).toThrow("damaged");
    expect(() => decodeShareLink("nickelquerier://query?v=9&d=x")).toThrow("Unsupported link version 9");
    const empty = encodeShareLink({ name: "x", statement: "  ", tags: [] });
    expect(() => decodeShareLink(empty)).toThrow("does not contain a query");
  });

  it("defaults the name when missing", () => {
    const link = encodeShareLink({ name: "", statement: "SELECT 1", tags: [] });
    expect(decodeShareLink(link).name).toBe("Shared query");
  });
});
