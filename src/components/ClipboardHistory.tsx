import { useEffect, useRef, useState } from "react";
import { Clip } from "../lib/storage";
import "./ClipboardHistory.css";

interface Props {
  clips: Clip[];
  onInsert: (text: string) => void;
  onRemove: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Popover listing fragments copied in the editor; click (or Enter) inserts at the cursor. */
export default function ClipboardHistory({ clips, onInsert, onRemove, onClear, onClose }: Props) {
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const needle = filter.toLowerCase();
  const visible = clips.filter((c) => c.text.toLowerCase().includes(needle));

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  useEffect(() => setActive(0), [filter]);

  return (
    <div
      className="ch-root"
      ref={rootRef}
      role="dialog"
      aria-label="Clipboard history"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((i) => Math.min(i + 1, visible.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && visible[active]) {
          e.preventDefault();
          onInsert(visible[active].text);
        }
      }}
    >
      <div className="ch-head">
        <input
          className="input ch-filter"
          placeholder="Filter copied fragments…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
          aria-label="Filter clipboard history"
        />
        <button className="btn btn-ghost" onClick={onClear} disabled={clips.length === 0}>
          Clear
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="ch-empty">
          {clips.length === 0 ? "Copy or cut text in the editor and it shows up here." : "No match."}
        </div>
      ) : (
        <ul className="ch-list" role="listbox" aria-label="Copied fragments">
          {visible.map((c, i) => (
            <li
              key={c.text}
              role="option"
              aria-selected={i === active}
              className={`ch-item${i === active ? " active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => onInsert(c.text)}
              title={c.text}
            >
              <pre className="ch-text">{c.text.length > 300 ? c.text.slice(0, 300) + "…" : c.text}</pre>
              <button
                className="ch-remove"
                aria-label="Remove from history"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(c.text);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
