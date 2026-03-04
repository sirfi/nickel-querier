# ⬡ Nickel Querier — SQL+++ for Couchbase

A stable, workflow-oriented, cross-platform query tool for **Couchbase N1QL / SQL++**.

Built with **Tauri** (Rust backend) + **Monaco Editor** + **Couchbase Query Service REST API**.

---

## ✨ Features

### MVP
- **Syntax Highlighting & Snippets** — Full N1QL / SQL++ language definition with keyword colouring and 10+ built-in snippets (`select-from`, `upsert-doc`, `explain`, array comprehensions…)
- **Query Execution** — Sends statements to the Couchbase Query Service REST API, shows results in real time
- **JSON / Tree / Table Result Viewer** — Switch between a paginated table view, raw JSON, or an interactive collapsible tree
- **Query History** — Last 200 queries stored locally; searchable, re-runnable, deletable
- **Saved Queries** — Name, tag, and organise favourite queries; persistent across sessions
- **Schema-Aware Autocomplete** — Browses bucket → scope → collection hierarchy via REST; runs `INFER` to populate field completions in the editor

### Advanced (Optional)
- **EXPLAIN Plan Visualisation** — Renders the N1QL query plan as an interactive tree with colour-coded operator nodes (`Scan`, `Join`, `Filter`, `Aggregate`, `Mutate`, `Sort`)
- **Parameterized Queries** — Pass `$1`, `$name` positional / named parameters via the `args` field
- **Cross-platform** — Windows, macOS, Linux (via Tauri)

---

## 🏗️ Architecture

```
nickel-querier/
├── src/                         # React + TypeScript frontend
│   ├── components/
│   │   ├── ConnectionPanel.tsx  # Couchbase connection config & test
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

1. Click **⚙ Configure** in the top bar
2. Enter your Couchbase cluster host, Query Service port (default `8093`), and credentials
3. Click **Test Connection** to verify, then **Save & Apply**

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

- [ ] Multi-tab query editor
- [ ] Export results to CSV / JSON
- [ ] Dark / light theme toggle
- [ ] Connection profiles (multiple clusters)
- [ ] Index advisor integration (`ADVISE` statement)
- [ ] Query plan diff comparison