import { useState } from "react";
import { Advice } from "../lib/indexes";
import "./AdviseViewer.css";

interface Props {
  advice: Advice | null;
  isLoading: boolean;
  error: string | null;
  /** Open a statement (e.g. CREATE INDEX) in a new editor tab */
  onOpen: (statement: string) => void;
}

export default function AdviseViewer({ advice, isLoading, error, onOpen }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading) return <div className="av-placeholder">Asking the Index Advisor…</div>;
  if (error) {
    return (
      <div className="av-root">
        <div className="av-error-title">✕ ADVISE failed</div>
        <pre className="av-error">{error}</pre>
      </div>
    );
  }
  if (!advice) {
    return (
      <div className="av-placeholder">
        Click 💡 Advise to get index recommendations for the current statement.
      </div>
    );
  }

  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      setCopied(s);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="av-root">
      {advice.messages.map((m) => (
        <div key={m} className="av-message">{m}</div>
      ))}

      {advice.recommended.length > 0 && (
        <section>
          <h4 className="av-heading">Recommended indexes</h4>
          {advice.recommended.map((r) => (
            <div key={r.statement} className="av-card">
              <div className="av-card-head">
                <span className={`badge ${r.covering ? "badge-success" : "badge-warning"}`}>
                  {r.covering ? "covering" : "index"}
                </span>
                {r.rule && <span className="av-rule">{r.rule}</span>}
                <span style={{ flex: 1 }} />
                <button className="btn btn-ghost" onClick={() => copy(r.statement)}>
                  {copied === r.statement ? "✓ Copied" : "⧉ Copy"}
                </button>
                <button className="btn btn-ghost" onClick={() => onOpen(r.statement + ";")}>
                  ▶ Open in tab
                </button>
              </div>
              <pre className="av-stmt">{r.statement}</pre>
            </div>
          ))}
        </section>
      )}

      {advice.current.length > 0 && (
        <section>
          <h4 className="av-heading">Indexes currently used</h4>
          {advice.current.map((c) => (
            <div key={c.statement} className="av-current">
              <pre className="av-stmt">{c.statement}</pre>
              {c.status && <span className="av-rule">{c.status}</span>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
