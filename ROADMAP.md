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

## 🔜 v0.4 — Advanced Query Tooling (Planned)

- [ ] **Index Advisor** — Run `ADVISE` on the current statement and display recommended index definitions
- [ ] **Query Plan Diff** — Side-by-side comparison of two EXPLAIN plans to evaluate index or query changes
- [ ] **Named Parameters UI** — Dedicated parameters panel to fill `$name` / `$1` values before execution
- [ ] **Scan Consistency Picker** — Choose `not_bounded`, `request_plus`, or `at_plus` from the toolbar

---

## 🔜 v0.5 — Collaboration & Productivity (Planned)

- [ ] **Query Sharing** — Export a saved query as a shareable JSON snippet or a deep-link URL
- [ ] **Folder / Tag Organisation** — Group saved queries into nested folders with drag-and-drop
- [ ] **Keyboard Shortcut Cheat-Sheet** — In-app overlay listing all shortcuts (`Ctrl/⌘ + ?`)
- [ ] **Clipboard History** — Quick-paste recent query fragments from a side popover

---

## 💡 Future Ideas (Under Consideration)

- **AI Query Assistant** — Natural-language to N1QL conversion using a configurable LLM endpoint
- **SSH Tunnel Support** — Connect to Couchbase clusters only reachable via SSH bastion hosts
- **Cluster Dashboard** — Node status, memory, and replication stats from the Management API
- **Plugin System** — Allow community extensions for custom result renderers or snippet libraries
- **Team Sync** — Optional cloud-backed sync of saved queries and connection profiles

---

_Items may be reprioritised between releases. Open an issue to request a feature or share feedback._
