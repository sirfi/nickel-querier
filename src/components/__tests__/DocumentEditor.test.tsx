import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const calls: { statement: string; parameters?: unknown[] }[] = [];
let docs: Record<string, unknown> = {};
vi.mock("../../lib/commands", () => ({
  executeQuery: async (_c: unknown, req: { statement: string; parameters?: unknown[] }) => {
    calls.push(req);
    const key = req.parameters?.[0] as string;
    if (key === "boom") throw new Error("load failed");
    let results: unknown[] = [];
    if (req.statement.startsWith("SELECT")) results = key in docs ? [{ doc: docs[key] }] : [];
    if (req.statement.startsWith("UPSERT")) { docs[key] = req.parameters?.[1]; results = [{ cas: 1 }]; }
    if (req.statement.startsWith("DELETE")) { results = key in docs ? [{ id: key }] : []; delete docs[key]; }
    return { results, status: "success", metrics: {}, warnings: [], errors: [] };
  },
}));

import DocumentEditor from "../DocumentEditor";

const config = { host: "h", port: 8093, username: "u", password: "p", tls: false };
const ks = { bucket: "b", scope: "s", collection: "c" };

beforeEach(() => {
  calls.length = 0;
  docs = { k1: { name: "old" } };
});
afterEach(cleanup);

describe("DocumentEditor", () => {
  it("loads, edits and saves a document by key", async () => {
    render(<DocumentEditor config={config} keyspace={ks} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Document key (META().id)"), { target: { value: "k1" } });
    fireEvent.click(screen.getByText("Load"));
    const area = (await screen.findByDisplayValue(/"old"/)) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: '{"name":"new"}' } });
    fireEvent.click(screen.getByText("Save"));
    await screen.findByText("Saved k1");
    expect(docs.k1).toEqual({ name: "new" });
  });

  it("blocks saving invalid JSON", async () => {
    render(<DocumentEditor config={config} keyspace={ks} initialKey="k1" onClose={() => {}} />);
    const area = await screen.findByDisplayValue(/"old"/);
    fireEvent.change(area, { target: { value: "{broken" } });
    expect(screen.getByText(/Invalid JSON/)).toBeTruthy();
    expect((screen.getByText("Save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("deletes after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DocumentEditor config={config} keyspace={ks} initialKey="k1" onClose={() => {}} />);
    await screen.findByDisplayValue(/"old"/);
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(screen.getByText("Deleted k1")).toBeTruthy());
    expect(docs).toEqual({});
  });
});

describe("DocumentEditor — failed load", () => {
  it("does not keep the previous document editable when loading another key fails", async () => {
    render(<DocumentEditor config={config} keyspace={ks} initialKey="k1" onClose={() => {}} />);
    await screen.findByDisplayValue(/"old"/);
    fireEvent.change(screen.getByPlaceholderText("Document key (META().id)"), { target: { value: "boom" } });
    fireEvent.click(screen.getByText("Load"));
    await screen.findByText(/load failed/);
    expect((screen.getByText("Save") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Delete") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByDisplayValue(/"old"/)).toBeNull();
  });
});
