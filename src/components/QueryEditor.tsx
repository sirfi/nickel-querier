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
  onRun: () => void;
  onExplain: () => void;
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
      // Preserve cursor position as best-effort
      const pos = editor.getPosition();
      model.setValue(formatted);
      onChange(formatted);
      if (pos) editor.setPosition(pos);
    }
  }, [onChange]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl/Cmd + Enter to run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });
    // Ctrl/Cmd + Shift + E to explain
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
      () => {
        onExplain();
      }
    );
    // Ctrl/Cmd + S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });
    // Ctrl/Cmd + Shift + F to format
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        handleFormat();
      }
    );
  };

  // Update schema-based completions when fields change
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || schemaFields.length === 0) return;

    const disposable = monaco.languages.registerCompletionItemProvider("n1ql", {
      provideCompletionItems(
        _model: MonacoType.editor.ITextModel,
        _position: MonacoType.Position
      ): MonacoType.languages.ProviderResult<MonacoType.languages.CompletionList> {
        const fieldItems: MonacoType.languages.CompletionItem[] = schemaFields.map(
          (f) => ({
            label: f.name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: f.name,
            detail: f.field_type,
            sortText: "2" + f.name,
            documentation: `Field: ${f.name} (${f.field_type})`,
            range: new monaco.Range(0, 0, 0, 0),
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

  // Get selected text or full value for execution
  const getActiveStatement = useCallback((): string => {
    const editor = editorRef.current;
    if (!editor) return value;
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      return editor.getModel()?.getValueInRange(selection) ?? value;
    }
    return value;
  }, [value]);

  const handleRunClick = () => {
    // Expose selected statement to parent via a custom event or direct call
    // We store it in the editor ref for the parent to access
    onRun();
  };

  // Expose getActiveStatement via a property on the editor element
  useEffect(() => {
    const el = document.getElementById("query-editor-root");
    if (el) {
      (el as HTMLElement & { getActiveStatement?: () => string }).getActiveStatement =
        getActiveStatement;
    }
  }, [getActiveStatement]);

  return (
    <div className="query-editor-wrapper" id="query-editor-root">
      <div className="qe-toolbar">
        <button
          className="btn btn-primary"
          onClick={handleRunClick}
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
          onClick={onExplain}
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
