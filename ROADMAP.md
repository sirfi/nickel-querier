# ⬡ Nickel Querier — Roadmap

This document tracks completed work and planned features across all versions.

---

## ✅ v0.1 — Foundation (Completed)

- [x] **N1QL / SQL++ Syntax Highlighting** — Full language definition for Monaco Editor with keyword colouring and semantic token support
- [x] **10+ Built-in Snippets** — `select-from`, `upsert-doc`, `explain`, array comprehensions, `CREATE INDEX`, and more
- [x] **Query Execution** — POST to Couchbase Query Service REST API (`/query/service`), streaming result display
- [x] **Result Viewer** — Three-mode viewer: paginated Table, raw JSON, and interactive collapsible Tree
- [x] **Query History** — Last 200 queries stored in `localStorage`; searchable, re-runnable, deletable
- [x] **Saved Queries** — Name, tag, and organise favourite queries; persistent across sessions
- [x] **Schema-Aware Autocomplete** — Browses bucket → scope → collection hierarchy via REST; runs `INFER` to populate field completions
- [x] **EXPLAIN Plan Visualisation** — Renders the N1QL query plan as an interactive tree with colour-coded operator nodes
- [x] **Parameterized Queries** — Positional (`$1`) and named (`$name`) parameter support via the `args` field
- [x] **Cross-platform Desktop App** — Windows, macOS, Linux via Tauri

---

## ✅ v0.2 — Workflow Improvements (Completed)

- [x] **Multi-Tab Query Editor** — Open multiple independent query tabs, each with its own connection, query text, results, and EXPLAIN plan
- [x] **Connection Profiles** — Save, edit, and delete multiple named Couchbase cluster connections; remember the last-used connection; per-tab connection switching
- [x] **Connection Migration** — Automatically migrates legacy single-connection config to the new named-connections format

---

## ✅ v0.3 — Data & UX (Completed)

- [x] **Export Results** — Download query results as CSV or JSON file
- [x] **Dark / Light Theme Toggle** — Persist user's preferred colour scheme across sessions
- [x] **Editor Font Size Control** — Increase / decrease Monaco editor font size from the toolbar
- [x] **Query Formatting** — Auto-format SQL++ with a single shortcut (`Ctrl/⌘ + Shift + F`)
- [x] **Result Column Sorting & Filtering** — Click column headers to sort; type to filter rows in Table view

---

## ✅ v0.3.1 — Stability Fixes

- [x] Result panel no longer crashes after the first query (React hook order)
- [x] Run / Explain with a selection executes only the selected text; shortcuts no longer use stale query text
- [x] Query errors show the real message (`[code] msg`) instead of `[object Object]`
- [x] Schema Explorer lists scopes/collections (management API) and INFER uses correctly quoted keyspaces
- [x] EXPLAIN viewer renders `{ plan, text }` results, follows `~child` / `scan(s)`, warns on PrimaryScan
- [x] Formatter rewritten on a tokenizer: keeps comments, never uppercases field names, undoable
- [x] Table view: columns from all rows, `SELECT RAW` support, copy as TSV/JSON, state reset per result
- [x] Clear HTTP / auth errors from the backend; component, integration and Rust parser tests

---

## ✅ v0.4 — Advanced Query Tooling & Productivity (Completed)

- [x] **Index Advisor** — Run `ADVISE` on the current statement and display recommended index definitions
- [x] **Index List** — Indexes of each collection in the schema panel (`system:indexes`)
- [x] **Named Parameters UI** — Parameters panel to fill `$name` / `$1` values before execution
- [x] **Scan Consistency Picker** — `not_bounded` / `request_plus` per tab
- [x] **Query Cancellation** — Stop a running query on the server
- [x] **Run Statement Under Cursor** — Multi-statement scripts run one statement at a time
- [x] **Persistent Tabs & Resizable Panels**
- [x] **Document Editor & Row Detail Panel**
- [x] **Keychain Password Storage & TLS Verification Option**, configurable Management port
- [x] **Native Save-as Export**, saved-query import/export, connection shown in history
- [x] **Keyboard Shortcut Cheat-Sheet** (`Ctrl/⌘ + ?`) and keyspace autocomplete

## ✅ v0.5 — Collaboration & Productivity (Current Release — v0.5.1)

- [x] **Query Plan Diff** — Pin an EXPLAIN plan as baseline and compare the next one side by side (added / removed / changed operators, index summary)
- [x] **Folder / Tag Organisation** — Nested folders for saved queries with drag-and-drop (and keyboard) moves; tag filter bar
- [x] **Query Sharing** — `nickelquerier://query?…` links for saved queries; paste a link to open it in a new tab
- [x] **Clipboard History** — Recently copied editor fragments in a popover (`Ctrl/⌘ + Shift + V`)
- [x] **v0.5.1** — Tooltips stay inside the window, flip below the top bar and show on keyboard focus ([#16](https://github.com/sirfi/nickel-querier/issues/16))

## 🔜 v0.6 — Planned

- [ ] **OS Deep-Link Registration** — Open `nickelquerier://` links directly from the browser / chat (Tauri deep-link + single-instance plugins; needs per-platform testing)
- [ ] **`at_plus` Scan Consistency** — Needs mutation tokens (scan vectors) from the KV layer; the Query REST API alone cannot produce them

---

## 💡 Future Ideas (Under Consideration)

- **AI Query Assistant** — Natural-language to N1QL conversion using a configurable LLM endpoint
- **SSH Tunnel Support** — Connect to Couchbase clusters only reachable via SSH bastion hosts
- **Cluster Dashboard** — Node status, memory, and replication stats from the Management API
- **Plugin System** — Allow community extensions for custom result renderers or snippet libraries
- **Team Sync** — Optional cloud-backed sync of saved queries and connection profiles

---

_Items may be reprioritised between releases. Open an issue to request a feature or share feedback._
