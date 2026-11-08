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
          updateOptions: () => {},
          focus: () => {},
        },
        { KeyMod: { CtrlCmd: 0, Shift: 0 }, KeyCode: { Enter: 0, KeyE: 0, KeyS: 0, KeyF: 0 } }
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
