import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import SavedQueries from "../SavedQueries";
import { addSavedQuery, loadSavedQueries, loadSavedFolders } from "../../lib/storage";

function Harness() {
  const [queries, setQueries] = useState(loadSavedQueries());
  return (
    <SavedQueries
      queries={queries}
      onSelect={() => {}}
      onRefresh={() => setQueries(loadSavedQueries())}
      pendingStatement="SELECT 1"
    />
  );
}

/** Minimal DataTransfer for jsdom */
function fakeDataTransfer() {
  const data: Record<string, string> = {};
  return {
    data,
    get types() { return Object.keys(data); },
    setData: (t: string, v: string) => { data[t] = v; },
    getData: (t: string) => data[t] ?? "",
    effectAllowed: "", dropEffect: "",
  };
}

const sq = (id: string, folder?: string, tags: string[] = []) =>
  addSavedQuery({ id, name: id, statement: `SELECT '${id}'`, created_at: "2026-01-01T00:00:00Z", tags, folder });

beforeEach(() => {
  localStorage.clear();
  sq("daily-report", "Reports/Daily", ["ops"]);
  sq("loose-query");
  sq("weekly", "Reports", ["ops", "kpi"]);
});
afterEach(cleanup);

describe("SavedQueries folders", () => {
  it("shows a nested folder tree with recursive counts", () => {
    render(<Harness />);
    const reports = screen.getByRole("button", { name: /Reports/ , expanded: true });
    expect(reports.textContent).toContain("2");
    expect(screen.getByText("daily-report")).toBeTruthy();
    fireEvent.click(reports);
    expect(screen.queryByText("daily-report")).toBeNull();
  });

  it("moves a query by drag and drop onto a folder", () => {
    render(<Harness />);
    const dt = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("loose-query").closest("li")!, { dataTransfer: dt });
    const daily = screen.getByRole("button", { name: /📁 Daily/ }).parentElement!;
    fireEvent.dragOver(daily, { dataTransfer: dt });
    fireEvent.drop(daily, { dataTransfer: dt });
    expect(loadSavedQueries().find((q) => q.id === "loose-query")?.folder).toBe("Reports/Daily");
  });

  it("moves a folder into another folder by drag and drop", () => {
    sq("misc", "Misc");
    render(<Harness />);
    const dt = fakeDataTransfer();
    fireEvent.dragStart(screen.getByRole("button", { name: /📁 Misc/ }).parentElement!, { dataTransfer: dt });
    const reports = screen.getByRole("button", { name: /^▾ 📁 Reports/ }).parentElement!;
    fireEvent.drop(reports, { dataTransfer: dt });
    expect(loadSavedQueries().find((q) => q.id === "misc")?.folder).toBe("Reports/Misc");
  });

  it("moves a query with the keyboard via the folder field", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit loose-query" }));
    fireEvent.change(screen.getByLabelText("Folder"), { target: { value: "Archive" } });
    fireEvent.click(screen.getByText("Save"));
    expect(loadSavedQueries().find((q) => q.id === "loose-query")?.folder).toBe("Archive");
    expect(screen.getByRole("button", { name: /📁 Archive/ })).toBeTruthy();
  });

  it("filters by tag (flat list with folder labels)", () => {
    render(<Harness />);
    const tagbar = screen.getByLabelText("Filter by tag");
    fireEvent.click(within(tagbar).getByRole("button", { name: /kpi/ }));
    expect(screen.getByText("weekly")).toBeTruthy();
    expect(screen.queryByText("daily-report")).toBeNull();
    expect(screen.getByText("📁 Reports")).toBeTruthy();
  });

  it("creates, renames and deletes folders", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Empty");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness />);
    fireEvent.click(screen.getByText("＋ Folder"));
    expect(loadSavedFolders()).toEqual(["Empty"]);

    fireEvent.click(screen.getByRole("button", { name: "Rename Reports" }));
    const input = screen.getByLabelText("Folder name");
    fireEvent.change(input, { target: { value: "Team" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(loadSavedQueries().find((q) => q.id === "daily-report")?.folder).toBe("Team/Daily");

    fireEvent.click(screen.getByRole("button", { name: "Delete folder Team" }));
    expect(loadSavedQueries().find((q) => q.id === "daily-report")?.folder).toBe("Daily");
    expect(loadSavedQueries().find((q) => q.id === "weekly")?.folder).toBe("");
  });
});
