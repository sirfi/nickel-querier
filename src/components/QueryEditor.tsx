import { useRef, useEffect, useCallback, useState } from "react";
import MonacoEditor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { registerN1QLLanguage } from "../lib/n1ql-language";
import { SchemaField } from "../lib/types";
import { formatN1QL } from "../lib/n1ql-formatter";
import {
  loadEditorFontSize,
  saveEditorFontSize,
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_MAX,
} from "../lib/storage";
import type * as MonacoType from "monaco-editor";
import "./QueryEditor.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called with the selected text, or the whole editor content. */
  onRun: (statement: string) => void;
  /** Called with the selected text, or the whole editor content. */
  onExplain: (statement: string) => void;
  onSave: () => void;
  isRunning: boolean;
  schemaFields: SchemaField[];
  monacoTheme?: string;
}

export default function QueryEditor({
  value,
  onChange,
  onRun,
  onExplain,
  onSave,
  isRunning,
  schemaFields,
  monacoTheme = "nickel-dark",
}: Props) {
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoType | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => loadEditorFontSize());

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
  const callbacksRef = useRef({ onRun, onExplain, onSave, handleFormat, isRunning });
  callbacksRef.current = { onRun, onExplain, onSave, handleFormat, isRunning };

  /** Selected text if there is a non-empty selection, otherwise the whole editor value. */
  const getActiveStatement = useCallback((): string => {
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    if (editor && selection && !selection.isEmpty()) {
      const selected = editor.getModel()?.getValueInRange(selection);
      if (selected && selected.trim()) return selected;
    }
    return valueRef.current;
  }, []);

  const run = useCallback(() => {
    if (callbacksRef.current.isRunning) return;
    callbacksRef.current.onRun(getActiveStatement());
  }, [getActiveStatement]);

  const explain = useCallback(() => {
    if (callbacksRef.current.isRunning) return;
    callbacksRef.current.onExplain(getActiveStatement());
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
  };

  // Update schema-based completions when fields change
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || schemaFields.length === 0) return;

    const disposable = monaco.languages.registerCompletionItemProvider("n1ql", {
      provideCompletionItems(
        model: MonacoType.editor.ITextModel,
        position: MonacoType.Position
      ): MonacoType.languages.ProviderResult<MonacoType.languages.CompletionList> {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        );
        const fieldItems: MonacoType.languages.CompletionItem[] = schemaFields.map(
          (f) => ({
            label: f.name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: f.name,
            detail: f.field_type,
            sortText: "2" + f.name,
            documentation: `Field: ${f.name} (${f.field_type})`,
            range,
          })
        );
        return { suggestions: fieldItems };
      },
    });

    return () => disposable.dispose();
  }, [schemaFields]);

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
    <div className="query-editor-wrapper">
      <div className="qe-toolbar">
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
        <button
          className="btn"
          onClick={explain}
          disabled={isRunning}
          data-tooltip="Explain Plan (Ctrl+Shift+E)"
        >
          ⚡ Explain
        </button>
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
        <span className="qe-hint">
          Tip: Select text then Run to execute a sub-query
        </span>
      </div>
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
