import { SavedConnection, QueryTab } from "../lib/types";
import "./QueryTabs.css";

interface Props {
  tabs: QueryTab[];
  activeId: string;
  connections: SavedConnection[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onConnectionChange: (tabId: string, connectionId: string) => void;
}

export default function QueryTabs({
  tabs,
  activeId,
  connections,
  onSelect,
  onClose,
  onAdd,
  onConnectionChange,
}: Props) {
  return (
    <div className="query-tabs-bar">
      {tabs.map((tab) => {
        const conn = connections.find((c) => c.id === tab.connectionId);
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={`query-tab ${isActive ? "active" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            <span className="query-tab-label">{tab.label}</span>

            {/* Per-tab connection selector (visible only on active tab) */}
            {isActive && (
              <select
                className="query-tab-conn-select"
                value={tab.connectionId}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onConnectionChange(tab.id, e.target.value);
                }}
                title="Connection for this tab"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {!isActive && conn && (
              <span className="query-tab-conn-name">{conn.name}</span>
            )}

            {tabs.length > 1 && (
              <button
                className="query-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      <button className="query-tab-add" onClick={onAdd} title="New tab">
        +
      </button>
    </div>
  );
}
