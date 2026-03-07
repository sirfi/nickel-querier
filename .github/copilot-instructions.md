# Nickel Querier — GitHub Copilot Instructions

## Project Overview

**Nickel Querier** is a cross-platform desktop query tool for **Couchbase N1QL / SQL++**, built with:

- **Frontend**: React 18 + TypeScript + Vite, Monaco Editor
- **Backend**: Tauri 2 (Rust) — thin HTTP client to the Couchbase Query Service REST API
- **Persistence**: `localStorage` (via `src/lib/storage.ts`)
- **Testing**: Vitest (frontend), Rust built-in `#[test]` (backend)

The app is intentionally lightweight. There is no Node/Express server or database ORM — all Couchbase communication goes through the Tauri Rust process via `reqwest`.

---

## Repository Structure

```
src/                    # React + TypeScript UI
  components/           # One file per UI component (tsx + css)
  lib/
    commands.ts         # invoke() wrappers around Tauri commands
    n1ql-language.ts    # Monaco N1QL language registration
    storage.ts          # localStorage read/write helpers
    types.ts            # Shared TS interfaces (no runtime code)
  styles/               # global.css (design tokens), App.css (layout)
  App.tsx               # Root component — state orchestration only
src-tauri/src/
  lib.rs                # All Tauri commands + unit tests
  main.rs               # Tauri entry point (calls lib::run())
```

---

## Coding Conventions

### TypeScript / React

- **Functional components only** — no class components.
- **Named exports** for utility functions/hooks; **default export** for the component at the bottom of each file.
- Each component has its own `ComponentName.css` co-located in `src/components/`.
- State that belongs to a single component stays local (`useState`). Cross-component state lives in `App.tsx`.
- Avoid prop-drilling beyond two levels — lift state to `App.tsx` instead.
- Use `useCallback` for handlers passed down as props to prevent unnecessary re-renders.
- Types live in `src/lib/types.ts`; do not define interfaces inline in component files unless they are file-private.
- Never use `any`; prefer `unknown` and narrow with type guards.

### CSS

- Design tokens (colours, spacing, radii) are defined as CSS custom properties in `src/styles/global.css`. Always use tokens (`var(--color-primary)`) rather than hard-coded hex values.
- Component-level styles use plain CSS in the co-located `.css` file; no CSS-in-JS.
- Class names follow BEM-lite: `component-element` (e.g., `result-tab`, `result-tab-count`).

### Rust

- All Tauri commands are defined in `src-tauri/src/lib.rs` and registered in `pub fn run()`.
- Commands accept `ConnectionConfig` as their first argument.
- Errors are returned as `AppError` variants — always use `?` and `AppError::from` conversions; never `unwrap()` in command functions.
- Helper functions (`query_url`, `mgmt_url`, `build_client`) are private (`fn`, not `pub fn`).
- Every new command must have at least one `#[test]` in the `mod tests` block at the bottom of `lib.rs`.

---

## Key Patterns

### Adding a New Tauri Command

1. Define the async function in `src-tauri/src/lib.rs` with `#[tauri::command]`.
2. Register it in the `invoke_handler!` macro inside `pub fn run()`.
3. Add a typed wrapper in `src/lib/commands.ts` using `invoke<ReturnType>(…)`.
4. Write at least one unit test in the `#[cfg(test)] mod tests` block.

### Adding a New React Component

1. Create `src/components/MyComponent.tsx` and `src/components/MyComponent.css`.
2. Export the component as the default export.
3. Import CSS at the top: `import "./MyComponent.css"`.
4. Wire into `App.tsx` if it needs shared state.

### Persistence

- Use helpers from `src/lib/storage.ts` (`load<T>()` / `save<T>()`).
- Storage keys are constants at the top of `storage.ts` (`nq_*` prefix).
- Do not call `localStorage` directly from components.

---

## Testing

### Frontend (Vitest)

```bash
npm test           # run all tests once
npm run test:watch # watch mode
```

Test files live alongside the source they test (`*.test.ts`). Use `vi.spyOn` / `vi.stubGlobal` to mock `localStorage`. Do not import React in pure-logic tests.

### Backend (Rust)

```bash
cd src-tauri && cargo test
```

Tests live in `mod tests` at the bottom of `lib.rs`. Since commands make HTTP calls, unit tests cover only pure helpers (`query_url`, `mgmt_url`, `build_client`, `AppError` variants). Network-dependent commands are tested via integration/E2E only.

---

## N1QL / SQL++ Specifics

- The query language is **N1QL / SQL++** — a superset of SQL targeting JSON documents.
- Bucket/scope/collection identifiers use backtick quoting: `` `bucket`.`scope`.`collection` ``.
- The `INFER` statement discovers field schemas; `EXPLAIN` returns a JSON query plan.
- Common system keyspaces: `system:keyspaces`, `system:indexes`, `system:active_requests`.
- Default Query Service port: **8093** (HTTP) / **18093** (HTTPS).
- Default Management API port: **8091** (HTTP) / **18091** (HTTPS).

---

## Monaco Editor Integration

- N1QL language is registered in `src/lib/n1ql-language.ts` via `monaco.languages.register`.
- Autocompletion items come from two sources: static keywords/snippets (in `n1ql-language.ts`) and dynamic schema fields passed via the `schemaFields` prop on `QueryEditor`.
- The editor fires `onRun` on `Ctrl/⌘+Enter`, `onExplain` on `Ctrl/⌘+Shift+E`, and `onSave` on `Ctrl/⌘+S`.

---

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use `AppError` variants for all Rust errors | Use `unwrap()` or `expect()` in production command code |
| Use CSS tokens for colours | Hard-code hex values in component CSS |
| Keep `App.tsx` as the single source of truth for shared state | Spread shared state across multiple sibling components |
| Add a `#[test]` for every new Rust helper function | Leave new commands untested |
| Co-locate component CSS with its TSX file | Add styles to `global.css` unless they are truly global tokens |
| Use `unknown` + type guards | Use `any` |
