import { describe, it, expect, vi, beforeEach } from "vitest";

// A hand-written fake (not vi.fn) so that rejected calls are plain promises.
const calls: unknown[][] = [];
let fail: string | null = null;
vi.mock("./commands", () => ({
  setConnectionSecret: async (...a: unknown[]) => {
    // The first write is slow: without serialisation "second" would land first
    if (a[1] === "first") await new Promise((r) => setTimeout(r, 20));
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
    expect(r.migrated).toEqual({ c1: "pw" });
    expect(calls).toHaveLength(1);
  });

  it("reports no change when the keychain is unavailable", async () => {
    fail = "x";
    const r = await migrateConnectionSecrets([conn]);
    expect(r.migrated).toEqual({});
  });
});

describe("review fixes (PR #12)", () => {
  it("returns warnings when migration cannot use the keychain", async () => {
    fail = "no secret service";
    const r = await migrateConnectionSecrets([conn]);
    expect(r.warnings).toEqual([expect.stringContaining("no secret service")]);
  });

  it("applies migration results only to records that did not change meanwhile", async () => {
    const { applyMigratedSecrets } = await import("./secrets");
    const current = [
      { ...conn, id: "a", password: "old" },                       // unchanged → migrate
      { ...conn, id: "b", password: "edited-during-migration" },   // edited → keep as is
      { ...conn, id: "d", password: "new conn" },                   // added → keep
    ];
    const migratedIds = { a: "old", b: "old-b" };
    expect(applyMigratedSecrets(current, migratedIds)).toEqual([
      { ...conn, id: "a", password: "", keychain: true },
      current[1],
      current[2],
    ]);
  });

  it("serialises keychain writes in call order", async () => {
    const order: string[] = [];
    fail = null;
    const p1 = secureConnection({ ...conn, password: "first" }).then(() => order.push("first"));
    const p2 = secureConnection({ ...conn, password: "second" }).then(() => order.push("second"));
    await Promise.all([p1, p2]);
    expect(calls.map((c) => c[1])).toEqual(["first", "second"]);
    expect(order).toEqual(["first", "second"]);
  });
});
