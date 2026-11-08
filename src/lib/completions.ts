// ============================================================
// Nickel Querier — Schema-aware completion items (pure data)
// ============================================================
import { SchemaField } from "./types";

export interface SchemaSuggestion {
  kind: "field" | "keyspace";
  label: string;
  insertText: string;
  /** Text Monaco matches the typed word against */
  filterText: string;
  detail: string;
  sortText: string;
}

/**
 * Field and keyspace suggestions. Keyspaces are inserted quoted
 * (`` `travel-sample`.`inventory`.`airline` ``); when the user already typed an
 * opening backtick it is consumed by the replace range (see `extendForBacktick`).
 */
export function buildSchemaSuggestions(fields: SchemaField[], keyspaces: string[]): SchemaSuggestion[] {
  const out: SchemaSuggestion[] = fields.map((f) => ({
    kind: "field",
    label: f.name,
    insertText: f.name,
    filterText: f.name,
    detail: f.field_type,
    sortText: "2" + f.name,
  }));
  for (const ks of keyspaces) {
    const plain = ks.replace(/`/g, "");
    out.push({
      kind: "keyspace",
      label: plain,
      insertText: ks,
      filterText: "`" + plain,
      detail: "keyspace",
      sortText: "1" + plain,
    });
  }
  return out;
}

/** Start column of the replace range: include a backtick right before the word. */
export function extendForBacktick(lineText: string, wordStartColumn: number): number {
  return lineText[wordStartColumn - 2] === "`" ? wordStartColumn - 1 : wordStartColumn;
}
