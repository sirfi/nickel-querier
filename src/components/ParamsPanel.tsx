import { useMemo } from "react";
import { detectParameters, detectedKeys } from "../lib/params";
import "./ParamsPanel.css";

interface Props {
  statement: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

/** Inputs for the `$1` / `$name` parameters found in the current statement. */
export default function ParamsPanel({ statement, values, onChange }: Props) {
  const keys = useMemo(() => detectedKeys(detectParameters(statement)), [statement]);
  if (keys.length === 0) return null;

  return (
    <div className="pp-root" aria-label="Query parameters">
      <span className="pp-title" title="Values are parsed as JSON when possible (42, true, &quot;text&quot;, [1,2]); anything else is sent as text.">
        Parameters
      </span>
      {keys.map((k) => (
        <label key={k} className="pp-item">
          <span className="pp-name">{k}</span>
          <input
            className={`input pp-input ${(values[k] ?? "").trim() === "" ? "pp-empty" : ""}`}
            value={values[k] ?? ""}
            placeholder="value"
            onChange={(e) => onChange({ ...values, [k]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
