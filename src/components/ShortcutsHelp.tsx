import { useEffect } from "react";
import "./ConnectionManager.css";
import "./ShortcutsHelp.css";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

export const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: "Queries",
    items: [
      [`${mod}+Enter`, "Run the selection / statement under the cursor"],
      [`${mod}+Shift+E`, "EXPLAIN"],
      [`${mod}+Shift+A`, "Index Advisor (ADVISE)"],
      [`${mod}+Shift+F`, "Format query"],
      [`${mod}+S`, "Save query"],
    ],
  },
  {
    group: "Editor",
    items: [
      [`${mod}+Space`, "Suggestions (keywords, fields, keyspaces)"],
      [`${mod}+/`, "Toggle line comment"],
      [`${mod}+Z`, "Undo (also undoes Format)"],
      ["Alt+↑ / Alt+↓", "Move line up / down"],
      ["F1", "Editor command palette"],
    ],
  },
  {
    group: "App",
    items: [
      [`${mod}+?`, "Show this list"],
      ["Esc", "Close dialogs and the row detail panel"],
      ["Arrow keys on a divider", "Resize panels"],
    ],
  },
];

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cm-modal sh-modal" role="dialog" aria-label="Keyboard shortcuts">
        <div className="cm-header">
          <h2 className="cm-title">⌨ Keyboard Shortcuts</h2>
          <button className="btn btn-ghost cm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sh-body">
          {SHORTCUTS.map((g) => (
            <section key={g.group}>
              <h3 className="sh-group">{g.group}</h3>
              <dl className="sh-list">
                {g.items.map(([keys, what]) => (
                  <div key={keys} className="sh-row">
                    <dt><kbd>{keys}</kbd></dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** True for Ctrl/⌘ + ? (Shift + /) */
export function isHelpShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && (e.key === "?" || (e.shiftKey && (e.key === "/" || e.code === "Slash")));
}
