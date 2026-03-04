import { useRef, useEffect, useCallback } from "react";
import MonacoEditor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { registerN1QLLanguage } from "../lib/n1ql-language";
import { SchemaField } from "../lib/types";
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
}

export default function QueryEditor({
  value,
  onChange,
  onRun,
  onExplain,
  onSave,
  isRunning,
  schemaFields,
}: Props) {
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoType | null>(null);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    registerN1QLLanguage(monaco);
  };

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
        <span className="qe-hint">
          Tip: Select text then Run to execute a sub-query
        </span>
      </div>
      <div className="qe-monaco">
        <MonacoEditor
          height="100%"
          language="n1ql"
          theme="nickel-dark"
          value={value}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 14,
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
