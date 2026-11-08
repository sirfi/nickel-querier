import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";

// Per-host fake cluster metadata; metadata requests can be held open.
const clusters: Record<string, Record<string, { scope: string; collection: string }[]>> = {
  old: { shared: [{ scope: "inventory", collection: "from_old_cluster" }] },
  new: { shared: [{ scope: "inventory", collection: "from_new_cluster" }], other: [{ scope: "s", collection: "airline" }] },
};
let hold: (() => void)[] = [];
let holdRequests = false;
const metadataCalls: string[] = [];

vi.mock("../../lib/commands", () => ({
  listBuckets: async (c: { host: string }) =>
    Object.keys(clusters[c.host]).map((name) => ({ name, bucket_type: "membase" })),
  getKeyspaceMetadata: (c: { host: string }, bucket: string) => {
    metadataCalls.push(`${c.host}/${bucket}`);
    const result = clusters[c.host][bucket].map((x) => ({ bucket, ...x, fields: [] }));
    if (!holdRequests) return Promise.resolve(result);
    return new Promise((resolve) => hold.push(() => resolve(result)));
  },
  inferSchema: async () => [],
  executeQuery: async () => ({ results: [] }),
}));

import SchemaExplorer from "../SchemaExplorer";

const cfg = (host: string) => ({ host, port: 8093, username: "u", password: "p", tls: false });

beforeEach(() => {
  hold = [];
  holdRequests = false;
  metadataCalls.length = 0;
});
afterEach(cleanup);

describe("SchemaExplorer", () => {
  it("ignores metadata that arrives after the connection changed", async () => {
    holdRequests = true;
    const props = { onFieldsChange: () => {}, onOpenQuery: () => {} };
    const { rerender } = render(<SchemaExplorer config={cfg("old")} {...props} />);
    fireEvent.click(await screen.findByText("shared"));
    rerender(<SchemaExplorer config={cfg("new")} {...props} />);
    await screen.findByText("other");
    await act(async () => hold.forEach((r) => r())); // late answer from the old cluster
    expect(screen.queryByText("inventory.from_old_cluster")).toBeNull();

    holdRequests = false;
    fireEvent.click(screen.getByText("shared"));
    expect(await screen.findByText("inventory.from_new_cluster")).toBeTruthy();
    expect(metadataCalls).toEqual(["old/shared", "new/shared"]);
  });

  it("keeps buckets whose collections are not loaded yet visible while filtering", async () => {
    render(<SchemaExplorer config={cfg("new")} onFieldsChange={() => {}} onOpenQuery={() => {}} />);
    await screen.findByText("other");
    fireEvent.change(screen.getByPlaceholderText("Filter buckets / collections…"), { target: { value: "airline" } });
    // "other" contains s.airline but has not been opened yet
    fireEvent.click(screen.getByText("other"));
    await waitFor(() => expect(screen.getByText("s.airline")).toBeTruthy());
    // once loaded, a bucket without a match is hidden
    fireEvent.click(screen.getByText("shared"));
    await waitFor(() => expect(screen.queryByText("shared")).toBeNull());
  });
});
