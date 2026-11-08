import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ResultViewer from "../ResultViewer";
import type { QueryResult } from "../../lib/types";

afterEach(cleanup);

function makeResult(results: unknown[]): QueryResult {
  return {
    results,
    status: "success",
    metrics: {
      elapsed_time: "1ms",
      execution_time: "1ms",
      result_count: results.length,
      result_size: 0,
      mutation_count: 0,
      error_count: 0,
      warning_count: 0,
    },
    warnings: [],
    errors: [],
  };
}

describe("ResultViewer", () => {
  it("does not crash when switching from loading to a result (hook order)", () => {
    const { rerender } = render(<ResultViewer result={null} error={null} isLoading />);
    rerender(<ResultViewer result={makeResult([{ a: 1 }])} error={null} isLoading={false} />);
    expect(screen.getByText("a")).toBeTruthy();
  });

  it("shows columns that only appear in later rows", () => {
    render(
      <ResultViewer result={makeResult([{ a: 1 }, { a: 2, b: "late" }])} error={null} isLoading={false} />
    );
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("late")).toBeTruthy();
  });

  it("renders SELECT RAW primitive results as a value column", () => {
    render(<ResultViewer result={makeResult(["x", "y"])} error={null} isLoading={false} />);
    expect(screen.getByText("$value")).toBeTruthy();
    expect(screen.getByText("y")).toBeTruthy();
  });

  it("resets the filter when a new result arrives", () => {
    const { rerender } = render(
      <ResultViewer result={makeResult([{ a: "one" }, { a: "two" }])} error={null} isLoading={false} />
    );
    fireEvent.change(screen.getByPlaceholderText("Filter rows…"), { target: { value: "one" } });
    expect(screen.queryByText("two")).toBeNull();
    rerender(
      <ResultViewer result={makeResult([{ a: "two" }, { a: "three" }])} error={null} isLoading={false} />
    );
    expect(screen.getByText("three")).toBeTruthy();
  });

  it("does not add an ellipsis to short objects", () => {
    render(<ResultViewer result={makeResult([{ o: { x: 1 } }])} error={null} isLoading={false} />);
    expect(screen.getByText('{"x":1}')).toBeTruthy();
  });
});
