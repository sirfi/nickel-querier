import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useEffect } from "react";

// ---- Fake Monaco -----------------------------------------------------------
const commands: Record<number, () => void> = {};
let selectionText = "";
let cursorOffset: number | null = null;

const fakeEditor = {
  addCommand: (key: number, fn: () => void) => {
    commands[key] = fn;
  },
  getSelection: () => ({ isEmpty: () => selectionText === "" }),
  getModel: () => ({
    getValueInRange: () => selectionText,
    getValue: () => "",
    setValue: () => {},
    getOffsetAt: () => cursorOffset ?? 0,
    getPositionAt: () => ({ lineNumber: 1, column: 1 }),
  }),
  getPosition: () => (cursorOffset === null ? null : { lineNumber: 1, column: cursorOffset + 1 }),
  setPosition: () => {},
  updateOptions: () => {},
  focus: () => {},
};

const fakeMonaco = {
  KeyMod: { CtrlCmd: 1 << 11, Shift: 1 << 10 },
  KeyCode: { Enter: 3, KeyE: 35, KeyS: 49, KeyF: 36, KeyA: 31 },
  languages: {
    getLanguages: () => [{ id: "n1ql" }],
    registerCompletionItemProvider: () => ({ dispose: () => {} }),
    CompletionItemKind: { Field: 3, Module: 8 },
  },
};

vi.mock("@monaco-editor/react", () => ({
  default: function MockEditor(props: {
    beforeMount?: (m: unknown) => void;
    onMount?: (e: unknown, m: unknown) => void;
  }) {
    useEffect(() => {
      props.beforeMount?.(fakeMonaco);
      props.onMount?.(fakeEditor, fakeMonaco);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="monaco" />;
  },
}));

import QueryEditor from "../QueryEditor";

afterEach(() => {
  cleanup();
  selectionText = "";
  cursorOffset = null;
});

const RUN_KEY = fakeMonaco.KeyMod.CtrlCmd | fakeMonaco.KeyCode.Enter;

function renderEditor(props: Partial<React.ComponentProps<typeof QueryEditor>> = {}) {
  const base = {
    value: "SELECT 1; SELECT 2",
    onChange: () => {},
    onRun: vi.fn(),
    onExplain: vi.fn(),
    onSave: vi.fn(),
    isRunning: false,
    schemaFields: [],
  };
  return { ...render(<QueryEditor {...base} {...props} />), props: { ...base, ...props } };
}

describe("QueryEditor", () => {
  it("runs the whole text when nothing is selected", () => {
    const { props } = renderEditor();
    fireEvent.click(screen.getByText("▶ Run"));
    expect(props.onRun).toHaveBeenCalledWith("SELECT 1; SELECT 2");
  });

  it("runs only the selected text when there is a selection", () => {
    const { props } = renderEditor();
    selectionText = "SELECT 2";
    fireEvent.click(screen.getByText("▶ Run"));
    expect(props.onRun).toHaveBeenCalledWith("SELECT 2");
  });

  it("runs only the statement under the cursor when there are several", () => {
    const { props } = renderEditor();
    cursorOffset = "SELECT 1; SELECT".length;
    fireEvent.click(screen.getByText("▶ Run"));
    expect(props.onRun).toHaveBeenCalledWith(" SELECT 2");
  });

  it("Ctrl+Enter uses the latest onRun callback and value, not the ones from mount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, props } = renderEditor({ onRun: first });
    rerender(<QueryEditor {...props} value="SELECT 42" onRun={second} />);
    commands[RUN_KEY]();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("SELECT 42");
  });
});
