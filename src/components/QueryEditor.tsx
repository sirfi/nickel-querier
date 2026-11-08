import { useRef, useEffect, useCallback, useState } from "react";
import MonacoEditor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { registerN1QLLanguage } from "../lib/n1ql-language";
import { SchemaField } from "../lib/types";
import { formatN1QL } from "../lib/n1ql-formatter";
import { splitStatements, statementAtOffset } from "../lib/statements";
import {
  buildSchemaSuggestions,
  extendForBacktick,
  fieldReplaceStart,
  typedPathBefore,
} from "../lib/completions";
import ClipboardHistory from "./ClipboardHistory";
import {
  loadClips,
  addClip,
  removeClip,
  clearClips,
  type Clip,
  loadEditorFontSize,
  saveEditorFontSize,
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_MAX,
} from "../lib/storage";
import type * as MonacoType from "monaco-editor";
import type { ReactNode } from "react";
import type { ScanConsistency } from "../lib/types";
import "./QueryEditor.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called with the selected text, or the whole editor content. */
  onRun: (statement: string) => void;
  /** Called with the selected text, or the whole editor content. */
  onExplain: (statement: string) => void;
  /** Index Advisor for the active statement */
  onAdvise?: (statement: string) => void;
  onSave: () => void;
  /** Present while a cancellable query is running. */
  onCancel?: () => void;
  isCancelling?: boolean;
  isRunning: boolean;
  schemaFields: SchemaField[];
  /** Quoted keyspace paths for completion */
  keyspaces?: string[];
  monacoTheme?: string;
  scanConsistency?: ScanConsistency;
  onScanConsistencyChange?: (value: ScanConsistency) => void;
  /** Rendered between the toolbar and the editor (e.g. the parameters panel). */
  belowToolbar?: ReactNode;
}

export default function QueryEditor({
  value,
  onChange,
  onRun,
  onExplain,
  onAdvise,
  onSave,
  onCancel,
  isCancelling = false,
  isRunning,
  schemaFields,
  keyspaces = [],
  monacoTheme = "nickel-dark",
  scanConsistency = "not_bounded",
  onScanConsistencyChange,
  belowToolbar,
}: Props) {
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoType | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => loadEditorFontSize());
  // Monaco loads asynchronously; effects that need it re-run once it is ready.
  const [monacoReady, setMonacoReady] = useState(false);
  const [showClips, setShowClips] = useState(false);
  const [clips, setClips] = useState<Clip[]>(() => loadClips());

  /** Record what the editor copies/cuts (Monaco copies the whole line when nothing is selected). */
  const recordCopy = () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const sel = editor?.getSelection();
    if (!editor || !model || !sel) return;
    const text = sel.isEmpty()
      ? model.getLineContent(sel.positionLineNumber) + "\n"
      : model.getValueInRange(sel);
    setClips(addClip(text));
  };

  const insertClip = (text: string) => {
    const editor = editorRef.current;
    const sel = editor?.getSelection();
    setShowClips(false);
    if (!editor || !sel) return;
    editor.pushUndoStop();
    editor.executeEdits("clipboard-history", [{ range: sel, text, forceMoveMarkers: true }]);
    editor.pushUndoStop();
    editor.focus();
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    registerN1QLLanguage(monaco);
  };

  const handleFormat = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const current = model.getValue();
    const formatted = formatN1QL(current);
    if (formatted !== current) {
      // executeEdits keeps the undo stack, so Ctrl+Z reverts the formatting.
      // Monaco's change event propagates the new value through onChange.
      editor.pushUndoStop();
      editor.executeEdits("nickel-format", [
        { range: model.getFullModelRange(), text: formatted },
      ]);
      editor.pushUndoStop();
    }
  }, []);

  // Latest value / callbacks, read by Monaco commands registered once at mount.
  const valueRef = useRef(value);
  valueRef.current = value;
  const callbacksRef = useRef({ onRun, onExplain, onAdvise, onSave, handleFormat, isRunning });
  callbacksRef.current = { onRun, onExplain, onAdvise, onSave, handleFormat, isRunning };

  /** Briefly highlight the range that is about to run. */
  const flashRange = (start: number, end: number) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model || !editor.createDecorationsCollection) return;
    const a = model.getPositionAt(start);
    const b = model.getPositionAt(end);
    const deco = editor.createDecorationsCollection([
      {
        range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
        options: { className: "qe-running-statement", isWholeLine: false },
      },
    ]);
    setTimeout(() => deco.clear(), 600);
  };

  /**
   * What to execute: the selection if there is one; otherwise, when the
   * editor holds several statements, the one under the cursor; otherwise
   * the whole editor value.
   */
  const getActiveStatement = useCallback((): string => {
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    if (editor && selection && !selection.isEmpty()) {
      const selected = editor.getModel()?.getValueInRange(selection);
      if (selected && selected.trim()) return selected;
    }
    const value = valueRef.current;
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (model?.getOffsetAt && position && splitStatements(value).length > 1) {
      const stmt = statementAtOffset(value, model.getOffsetAt(position));
      if (stmt) {
        flashRange(stmt.start, stmt.end);
        return stmt.text;
      }
    }
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(() => {
    if (callbacksRef.current.isRunning) return;
    callbacksRef.current.onRun(getActiveStatement());
  }, [getActiveStatement]);

  const explain = useCallback(() => {
    if (callbacksRef.current.isRunning) return;
    callbacksRef.current.onExplain(getActiveStatement());
  }, [getActiveStatement]);

  const advise = useCallback(() => {
    if (callbacksRef.current.isRunning) return;
    callbacksRef.current.onAdvise?.(getActiveStatement());
  }, [getActiveStatement]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl/Cmd + Enter to run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
    // Ctrl/Cmd + Shift + E to explain
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
      explain
    );
    // Ctrl/Cmd + Shift + A for the Index Advisor
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA,
      advise
    );
    // Ctrl/Cmd + Shift + V: clipboard history
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
      () => {
        setClips(loadClips());
        setShowClips(true);
      }
    );
    // Ctrl/Cmd + S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      callbacksRef.current.onSave()
    );
    // Ctrl/Cmd + Shift + F to format
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => callbacksRef.current.handleFormat()
    );
    editor.focus();
    setMonacoReady(true);
  };

  // Schema-based completions (fields of the inferred collection + keyspaces)
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monacoReady || !monaco) return;
    const items = buildSchemaSuggestions(schemaFields, keyspaces);
    if (items.length === 0) return;

    const disposable = monaco.languages.registerCompletionItemProvider("n1ql", {
      triggerCharacters: ["`"],
      provideCompletionItems(
        model: MonacoType.editor.ITextModel,
        position: MonacoType.Position
      ): MonacoType.languages.ProviderResult<MonacoType.languages.CompletionList> {
        const word = model.getWordUntilPosition(position);
        const line = model.getLineContent(position.lineNumber);
        const typed = typedPathBefore(line.slice(0, position.column - 1));
        const typedStartColumn = position.column - typed.length;
        // Nested fields: also replace the part of the dotted path already typed
        const fieldRange = (name: string) =>
          new monaco.Range(
            position.lineNumber,
            typed ? typedStartColumn + fieldReplaceStart(typed, name) : word.startColumn,
            position.lineNumber,
            word.endColumn
          );
        const ks = extendForBacktick(line, word.startColumn, word.endColumn);
        const ksRange = new monaco.Range(
          position.lineNumber, ks.startColumn, position.lineNumber, ks.endColumn
        );
        return {
          suggestions: items.map((s) => ({
            label: s.label,
            kind:
              s.kind === "field"
                ? monaco.languages.CompletionItemKind.Field
                : monaco.languages.CompletionItemKind.Module,
            insertText: s.insertText,
            filterText: s.filterText,
            detail: s.detail,
            sortText: s.sortText,
            range: s.kind === "field" ? fieldRange(s.insertText) : ksRange,
          })),
        };
      },
    });

    return () => disposable.dispose();
  }, [schemaFields, keyspaces, monacoReady]);

  // Sync font size changes to editor instance
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  const handleFontSizeChange = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, prev + delta));
      saveEditorFontSize(next);
      return next;
    });
  };

  return (
    <div className="query-editor-wrapper" onCopyCapture={recordCopy} onCutCapture={recordCopy}>
      <div className="qe-toolbar">
        {onCancel ? (
          <button
            className="btn btn-danger"
            onClick={onCancel}
            disabled={isCancelling}
            data-tooltip="Stop the running query"
          >
            {isCancelling ? (
              <>
                <span className="spinner" /> Stopping…
              </>
            ) : (
              <>■ Stop</>
            )}
          </button>
        ) : (
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={isRunning}
          data-tooltip="Run (Ctrl+Enter)"
        >
          {isRunning ? (
            <>
              <span className="spinner" /> Running…
            </>
          ) : (
            <>▶ Run</>
          )}
        </button>
        )}
        <button
          className="btn"
          onClick={explain}
          disabled={isRunning}
          data-tooltip="Explain Plan (Ctrl+Shift+E)"
        >
          ⚡ Explain
        </button>
        {onAdvise && (
          <button
            className="btn"
            onClick={advise}
            disabled={isRunning}
            data-tooltip="Index Advisor (Ctrl+Shift+A)"
          >
            💡 Advise
          </button>
        )}
        <button
          className="btn"
          onClick={onSave}
          data-tooltip="Save Query (Ctrl+S)"
        >
          ✦ Save
        </button>
        <button
          className="btn"
          onClick={handleFormat}
          data-tooltip="Format Query (Ctrl+Shift+F)"
        >
          ⌥ Format
        </button>
        <div className="qe-font-size">
          <button
            className="btn btn-ghost qe-font-btn"
            onClick={() => handleFontSizeChange(-1)}
            disabled={fontSize <= EDITOR_FONT_SIZE_MIN}
            data-tooltip="Decrease font size"
          >
            A−
          </button>
          <span className="qe-font-label">{fontSize}px</span>
          <button
            className="btn btn-ghost qe-font-btn"
            onClick={() => handleFontSizeChange(1)}
            disabled={fontSize >= EDITOR_FONT_SIZE_MAX}
            data-tooltip="Increase font size"
          >
            A+
          </button>
        </div>
        {onScanConsistencyChange && (
          <select
            className="qe-select"
            value={scanConsistency}
            onChange={(e) => onScanConsistencyChange(e.target.value as ScanConsistency)}
            data-tooltip="Scan consistency: request_plus waits for indexes to include all prior mutations"
            aria-label="Scan consistency"
          >
            <option value="not_bounded">not_bounded</option>
            <option value="request_plus">request_plus</option>
          </select>
        )}
        <button
          className="btn btn-ghost"
          onClick={() => {
            setClips(loadClips());
            setShowClips((v) => !v);
          }}
          data-tooltip="Clipboard history (Ctrl+Shift+V)"
          aria-label="Clipboard history"
          aria-expanded={showClips}
        >
          📋
        </button>
        {showClips && (
          <ClipboardHistory
            clips={clips}
            onInsert={insertClip}
            onRemove={(t) => setClips(removeClip(t))}
            onClear={() => {
              clearClips();
              setClips([]);
            }}
            onClose={() => {
              setShowClips(false);
              editorRef.current?.focus();
            }}
          />
        )}
        <span className="qe-hint">
          Runs the selection, or the statement under the cursor
        </span>
      </div>
      {belowToolbar}
      <div className="qe-monaco">
        <MonacoEditor
          height="100%"
          language="n1ql"
          theme={monacoTheme}
          value={value}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize,
            fontFamily: "var(--font-mono)",
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            snippetSuggestions: "top",
            folding: true,
            bracketPairColorization: { enabled: true },
            renderLineHighlight: "line",
            renderWhitespace: "none",
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
