import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";

vi.mock("@monaco-editor/react", () => ({
  default: function MockEditor(props: {
    value: string;
    onChange?: (v: string) => void;
    onMount?: (e: unknown, m: unknown) => void;
  }) {
    useEffect(() => {
      props.onMount?.(
        {
          addCommand: () => {},
          getSelection: () => null,
          getModel: () => null,
          getPosition: () => null,
          updateOptions: () => {},
          focus: () => {},
        },
        { KeyMod: { CtrlCmd: 0, Shift: 0 }, KeyCode: { Enter: 0, KeyE: 0, KeyS: 0, KeyF: 0, KeyA: 0 } }
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <textarea
        data-testid="editor"
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    );
  },
}));

const executeQuery = vi.fn();
const getExplainPlan = vi.fn();
const cancelQuery = vi.fn();
vi.mock("../lib/commands", () => ({
  executeQuery: (...a: unknown[]) => executeQuery(...a),
  getExplainPlan: (...a: unknown[]) => getExplainPlan(...a),
  cancelQuery: (...a: unknown[]) => cancelQuery(...a),
  listBuckets: vi.fn(async () => []),
  getKeyspaceMetadata: vi.fn(async () => []),
  inferSchema: vi.fn(async () => []),
  testConnection: vi.fn(async () => true),
  setConnectionSecret: vi.fn(async () => { throw new Error("no keychain in tests"); }),
  deleteConnectionSecret: vi.fn(async () => {}),
}));

import App from "../App";

const okResult = (results: unknown[]) => ({
  results,
  status: "success",
  metrics: {
    elapsed_time: "3ms", execution_time: "2ms", result_count: results.length,
    result_size: 0, mutation_count: 0, error_count: 0, warning_count: 0,
  },
  warnings: [],
  errors: [],
});

beforeEach(() => {
  localStorage.clear();
  executeQuery.mockReset();
  getExplainPlan.mockReset();
  cancelQuery.mockReset();
});
afterEach(cleanup);

describe("App", () => {
  it("runs the editor text and shows results without crashing", async () => {
    executeQuery.mockResolvedValue(okResult([{ greeting: "hi" }]));
    render(<App />);
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "SELECT 'hi' AS greeting" } });
    fireEvent.click(screen.getByText("▶ Run"));
    await waitFor(() => expect(screen.getByText("greeting")).toBeTruthy());
    expect(executeQuery.mock.calls[0][1].statement).toBe("SELECT 'hi' AS greeting");
  });

  it("shows query errors and records them in history", async () => {
    executeQuery.mockRejectedValue(new Error("Query error: [3000] syntax error"));
    render(<App />);
    fireEvent.click(screen.getByText("▶ Run"));
    await waitFor(() => expect(screen.getByText("Query error: [3000] syntax error")).toBeTruthy());
    const history = JSON.parse(localStorage.getItem("nq_history") ?? "[]");
    expect(history[0].status).toBe("error");
    expect(history[0]).toMatchObject({ connectionId: "default", connectionName: "Default" });
  });

  it("renders an EXPLAIN plan returned as { plan, text }", async () => {
    getExplainPlan.mockResolvedValue({
      plan: { "#operator": "Sequence", "~children": [{ "#operator": "PrimaryScan3" }] },
      text: "SELECT 1",
    });
    render(<App />);
    fireEvent.click(screen.getAllByText("⚡ Explain")[0]);
    await waitFor(() => expect(screen.getByText("PrimaryScan3")).toBeTruthy());
  });

  it("keeps results per tab", async () => {
    executeQuery.mockResolvedValue(okResult([{ only_in_tab_1: 1 }]));
    render(<App />);
    fireEvent.click(screen.getByText("▶ Run"));
    await waitFor(() => expect(screen.getByText("only_in_tab_1")).toBeTruthy());
    fireEvent.click(screen.getByTitle("New tab"));
    expect(screen.queryByText("only_in_tab_1")).toBeNull();
  });

  it("stops a running query using its client_context_id", async () => {
    let reject!: (e: Error) => void;
    executeQuery.mockReturnValue(new Promise((_, r) => (reject = r)));
    cancelQuery.mockImplementation(async () => {
      reject(new Error("Query error: [1195] Request has been stopped"));
      return true;
    });
    render(<App />);
    fireEvent.click(screen.getByText("▶ Run"));
    fireEvent.click(await screen.findByText("■ Stop"));
    const ctx = executeQuery.mock.calls[0][1].client_context_id;
    expect(ctx).toBeTruthy();
    await waitFor(() => expect(cancelQuery).toHaveBeenCalledWith(expect.anything(), ctx));
    await waitFor(() => expect(screen.getByText(/Query cancelled/)).toBeTruthy());
    expect(screen.getByText("▶ Run")).toBeTruthy();
  });
});

describe("App tab persistence", () => {
  it("restores tabs and their queries after a restart", async () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByTitle("New tab"));
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "SELECT 'kept'" } });
    window.dispatchEvent(new Event("beforeunload"));
    unmount();
    render(<App />);
    expect(screen.getAllByText(/^Query \d+$/)).toHaveLength(2);
    expect((screen.getByTestId("editor") as HTMLTextAreaElement).value).toBe("SELECT 'kept'");
  });
});

describe("App parameters", () => {
  it("sends parameter values and scan consistency", async () => {
    executeQuery.mockResolvedValue(okResult([]));
    render(<App />);
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "SELECT $1, $city" } });
    fireEvent.change(screen.getByLabelText("Scan consistency"), { target: { value: "request_plus" } });
    const inputs = screen.getAllByPlaceholderText("value");
    fireEvent.change(inputs[0], { target: { value: "42" } });
    fireEvent.change(inputs[1], { target: { value: "Paris" } });
    fireEvent.click(screen.getByText("▶ Run"));
    await waitFor(() => expect(executeQuery).toHaveBeenCalled());
    const req = executeQuery.mock.calls[0][1];
    expect(req.parameters).toEqual([42]);
    expect(req.named_parameters).toEqual({ city: "Paris" });
    expect(req.scan_consistency).toBe("request_plus");
  });

  it("refuses to run with a missing parameter value", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "SELECT $x" } });
    fireEvent.click(screen.getByText("▶ Run"));
    expect(await screen.findByText("Missing value for parameter $x")).toBeTruthy();
    expect(executeQuery).not.toHaveBeenCalled();
  });
});

describe("App index advisor", () => {
  it("runs ADVISE and lets you open a recommended index in a new tab", async () => {
    executeQuery.mockResolvedValue(okResult([
      { advice: { adviseinfo: { recommended_indexes: { indexes: [{ index_statement: "CREATE INDEX adv ON `b`(`t`)" }] } } } },
    ]));
    render(<App />);
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "SELECT * FROM b WHERE t = 1;" } });
    fireEvent.click(screen.getAllByText("💡 Advise")[0]);
    expect(await screen.findByText("CREATE INDEX adv ON `b`(`t`)")).toBeTruthy();
    expect(executeQuery.mock.calls[0][1].statement).toBe("ADVISE SELECT * FROM b WHERE t = 1");
    fireEvent.click(screen.getByText("▶ Open in tab"));
    expect((screen.getByTestId("editor") as HTMLTextAreaElement).value).toBe("CREATE INDEX adv ON `b`(`t`);");
  });
});

describe("App shortcuts help", () => {
  it("opens with Ctrl+? and closes with Escape", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "?", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });
});

describe("App — review fixes (PR #12)", () => {
  const twoConnections = () =>
    localStorage.setItem("nq_connections", JSON.stringify([
      { id: "a", name: "Cluster A", host: "a.example", port: 8093, username: "u", password: "", tls: false, keychain: true },
      { id: "b", name: "Cluster B", host: "b.example", port: 8093, username: "u", password: "", tls: false, keychain: true },
    ]));

  it("sends Stop to the cluster the query started on, even after switching connection", async () => {
    twoConnections();
    executeQuery.mockReturnValue(new Promise(() => {}));
    cancelQuery.mockResolvedValue(true);
    render(<App />);
    fireEvent.click(screen.getByText("▶ Run"));
    fireEvent.change(screen.getByTitle("Select connection"), { target: { value: "b" } });
    fireEvent.click(await screen.findByText("■ Stop"));
    await waitFor(() => expect(cancelQuery).toHaveBeenCalled());
    expect(cancelQuery.mock.calls[0][0].host).toBe("a.example");
  });

  it("re-enables Stop and explains when cancellation fails", async () => {
    executeQuery.mockReturnValue(new Promise(() => {}));
    cancelQuery.mockResolvedValue(false);
    render(<App />);
    fireEvent.click(screen.getByText("▶ Run"));
    fireEvent.click(await screen.findByText("■ Stop"));
    expect(await screen.findByText(/did not find the request/)).toBeTruthy();
    expect((screen.getByText("■ Stop").closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("warns when existing passwords cannot be moved to the keychain", async () => {
    localStorage.setItem("nq_connections", JSON.stringify([
      { id: "p", name: "Plain", host: "h", port: 8093, username: "u", password: "secret", tls: false },
    ]));
    render(<App />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Plain");
  });

  it("moves focus into the shortcuts dialog and back", () => {
    render(<App />);
    const editor = screen.getByTestId("editor");
    editor.focus();
    fireEvent.keyDown(window, { key: "?", ctrlKey: true, shiftKey: true });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(editor);
  });
});

describe("App plan diff", () => {
  it("pins a plan and compares the next EXPLAIN against it", async () => {
    getExplainPlan.mockResolvedValueOnce({
      plan: { "#operator": "Sequence", "~children": [{ "#operator": "PrimaryScan3", index: "#primary" }] },
    });
    render(<App />);
    fireEvent.click(screen.getAllByText("⚡ Explain")[0]);
    fireEvent.click(await screen.findByText("📌 Pin as baseline"));

    getExplainPlan.mockResolvedValueOnce({
      plan: { "#operator": "Sequence", "~children": [{ "#operator": "IndexScan3", index: "idx_type" }] },
    });
    fireEvent.click(screen.getAllByText("⚡ Explain")[0]);
    const table = await screen.findByRole("table", { name: "Plan differences" });
    expect(table.textContent).toContain("PrimaryScan3");
    expect(table.textContent).toContain("IndexScan3");
    expect(screen.getByText("+1 added")).toBeTruthy();
    expect(screen.getByText("−1 removed")).toBeTruthy();
  });
});
