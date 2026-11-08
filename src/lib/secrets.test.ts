import { describe, it, expect, vi, beforeEach } from "vitest";

// A hand-written fake (not vi.fn) so that rejected calls are plain promises.
const calls: unknown[][] = [];
let fail: string | null = null;
vi.mock("./commands", () => ({
  setConnectionSecret: async (...a: unknown[]) => {
    calls.push(a);
    if (fail) throw new Error(fail);
  },
}));

import { secureConnection, migrateConnectionSecrets } from "./secrets";

const conn = { id: "c1", name: "P", host: "h", port: 8093, username: "u", password: "pw", tls: false };

beforeEach(() => {
  calls.length = 0;
  fail = null;
});

describe("secureConnection", () => {
  it("moves the password into the keychain", async () => {
    const r = await secureConnection(conn);
    expect(calls).toEqual([["c1", "pw"]]);
    expect(r.connection).toMatchObject({ password: "", keychain: true });
    expect(r.warning).toBeUndefined();
  });

  it("keeps the password locally with a warning when the keychain fails", async () => {
    fail = "no secret service";
    const r = await secureConnection(conn);
    expect(r.connection.password).toBe("pw");
    expect(r.connection.keychain).toBe(false);
    expect(r.warning).toContain("no secret service");
  });

  it("does nothing without a password", async () => {
    const r = await secureConnection({ ...conn, password: "", keychain: true });
    expect(calls).toHaveLength(0);
    expect(r.connection.keychain).toBe(true);
  });
});

describe("migrateConnectionSecrets", () => {
  it("migrates only plain-text passwords", async () => {
    const r = await migrateConnectionSecrets([
      conn,
      { ...conn, id: "c2", password: "", keychain: true },
      { ...conn, id: "c3", password: "" },
    ]);
    expect(r.changed).toBe(true);
    expect(calls).toHaveLength(1);
    expect(r.connections[0]).toMatchObject({ password: "", keychain: true });
  });

  it("reports no change when the keychain is unavailable", async () => {
    fail = "x";
    const r = await migrateConnectionSecrets([conn]);
    expect(r.changed).toBe(false);
    expect(r.connections[0].password).toBe("pw");
  });
});
