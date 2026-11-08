# ⬡ Nickel Querier — SQL+++ for Couchbase

![Version](https://img.shields.io/badge/version-0.5.0-blue)

A stable, workflow-oriented, cross-platform query tool for **Couchbase N1QL / SQL++**.

Built with **Tauri** (Rust backend) + **Monaco Editor** + **Couchbase Query Service REST API**.

---

## ✨ Features

### Core
- **Syntax Highlighting & Snippets** — Full N1QL / SQL++ language definition with keyword colouring and 10+ built-in snippets (`select-from`, `upsert-doc`, `explain`, array comprehensions…)
- **Multi-Tab Query Editor** — Open multiple independent query tabs, each with its own connection, results, and EXPLAIN plan
- **Query Execution** — Sends statements to the Couchbase Query Service REST API, shows results in real time
- **JSON / Tree / Table Result Viewer** — Switch between a paginated table view, raw JSON, or an interactive collapsible tree
- **Query History** — Last 200 queries stored locally; searchable, re-runnable, deletable
- **Saved Queries** — Name, tag, and organise favourite queries; persistent across sessions
- **Schema-Aware Autocomplete** — Browses bucket → scope → collection hierarchy via REST; runs `INFER` to populate field completions in the editor
- **Connection Profiles** — Save and manage multiple named Couchbase cluster connections; per-tab connection switching

### Advanced
- **EXPLAIN Plan Visualisation** — Renders the N1QL query plan as an interactive tree with colour-coded operator nodes (`Scan`, `Join`, `Filter`, `Aggregate`, `Mutate`, `Sort`)
- **Parameterized Queries** — Pass `$1`, `$name` positional / named parameters via the `args` field
- **Cross-platform** — Windows, macOS, Linux (via Tauri)
- **Export Results** — Download query results as CSV or JSON file
- **Dark / Light Theme Toggle** — Persist user's preferred colour scheme across sessions
- **Editor Font Size Control** — Increase / decrease Monaco editor font size from the toolbar
- **Query Formatting** — Auto-format SQL++ with a single shortcut (`Ctrl/⌘ + Shift + F`)
- **Result Column Sorting & Filtering** — Click column headers to sort; type to filter rows in Table view

### Productivity (v0.4)
- **Run the Statement Under the Cursor** — With several `;`-separated statements, `Ctrl/⌘ + Enter` runs only the one under the cursor (or the selection)
- **Stop Running Queries** — ■ Stop cancels the request on the server (`system:active_requests`)
- **Parameters Panel** — Inputs for `$1` / `$name` parameters found in the statement; scan consistency picker per tab
- **Index Advisor** — 💡 Advise (`Ctrl/⌘ + Shift + A`) runs `ADVISE` and shows recommended / covering indexes; the schema panel lists each collection's indexes
- **Document Editor** — Load a document by key, edit the JSON, save (UPSERT) or delete
- **Row Detail Panel** — Click a result row to see it as formatted JSON
- **Persistent Workspace** — Open tabs, queries, parameter values and panel sizes survive restarts; panels are resizable
- **Keyspace Completions** — Bucket and collection names in autocomplete; nested fields from `INFER`
- **Saved Query Import / Export** — Share saved queries as a JSON file; history remembers the connection used
- **Keyboard Shortcut List** — `Ctrl/⌘ + ?`

### Collaboration (v0.5)
- **Query Plan Diff** — 📌 Pin an EXPLAIN plan, change the query or add an index, EXPLAIN again and see both plans side by side
- **Folders & Tags** — Organise saved queries in nested folders (drag and drop), filter by tag
- **Share Links** — Copy a `nickelquerier://query?…` link for a saved query; 🔗 Open link to load one
- **Clipboard History** — `Ctrl/⌘ + Shift + V` re-inserts recently copied fragments

### Security
- **Passwords in the OS Keychain** — macOS Keychain, Windows Credential Manager or Linux Secret Service; older plain-text passwords are migrated automatically
- **TLS Certificate Verification** — On by default; can be turned off per connection for self-signed clusters

---

## 🏗️ Architecture

```
nickel-querier/
├── src/                         # React + TypeScript frontend
│   ├── components/
│   │   ├── ConnectionPanel.tsx  # Connection selector in top bar
│   │   ├── ConnectionManager.tsx# Named connection CRUD (add/edit/delete)
│   │   ├── QueryTabs.tsx        # Multi-tab bar with per-tab connection picker
│   │   ├── QueryEditor.tsx      # Monaco Editor with N1QL language
│   │   ├── ResultViewer.tsx     # Table / JSON / Tree result viewer
│   │   ├── QueryHistory.tsx     # Query history list
│   │   ├── SavedQueries.tsx     # Saved queries management
│   │   ├── SchemaExplorer.tsx   # Bucket/collection browser + INFER
│   │   └── ExplainViewer.tsx    # EXPLAIN plan tree visualisation
│   ├── lib/
│   │   ├── n1ql-language.ts     # Monaco N1QL language definition
│   │   ├── commands.ts          # Tauri command wrappers
│   │   ├── storage.ts           # localStorage persistence layer
│   │   └── types.ts             # Shared TypeScript interfaces
│   └── styles/
│       ├── global.css           # Design tokens, utilities
│       └── App.css              # Layout
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   └── lib.rs               # Commands: execute_query, explain, list_buckets…
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- Tauri system dependencies for your OS: https://tauri.app/v1/guides/getting-started/prerequisites

### Install & Run

```bash
# Install frontend dependencies
npm install

# Run in development mode (hot-reload)
npm run tauri dev

# Build for production
npm run tauri build
```

### Connecting to Couchbase

1. Click **⚙ Manage** in the top bar, then **+ Add Connection**
2. Enter the host, Query Service port (default `8093`, `18093` with TLS) and credentials.
   The Management port defaults to `8091` / `18091`.
3. For TLS with a self-signed certificate, untick **Verify TLS certificate**
4. Click **Test** to verify, then **Save** — the password is stored in your OS keychain

The Schema Explorer panel will automatically load your buckets.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + Enter` | Run query (or selected text) |
| `Ctrl/⌘ + Shift + E` | EXPLAIN query plan |
| `Ctrl/⌘ + S` | Save query |

---

## 🎨 Branding

**Nickel** — LightSteelBlue (`#B0C4DE`), the colour of the Ni element.  
**SQL+++** — A nod to the Couchbase SQL++ dialect (a superset of SQL).  
Logo: **⬡** (hexagon) — echoes the molecular hex structure and the Ni periodic table symbol.

---

## 📡 REST API Integration

The Couchbase Query Service is accessed via HTTP:

| Endpoint | Purpose |
|---|---|
| `POST /query/service` | Execute N1QL statement |
| `GET /pools/default/buckets` | List buckets (port 8091) |
| `system:keyspaces` | Enumerate scopes & collections |
| `INFER` statement | Discover field schema |

---

## 🛣️ Roadmap

See [ROADMAP.md](ROADMAP.md) for the full, versioned roadmap.

**Upcoming highlights (v0.4):**
- [ ] Index advisor integration (`ADVISE` statement)
- [ ] Query plan diff comparison
- [ ] Named parameters UI
- [ ] Scan consistency picker