# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

LocalMiniDrama (本地短剧助手) — an AI-powered local short drama creation tool. Single product, three sub-projects sharing one repo (no monorepo tooling).

### Services

| Service | Directory | Port | Start Command |
|---------|-----------|------|---------------|
| Backend (Express + SQLite) | `backend-node/` | 5679 | `npm run dev` |
| Frontend (Vite + Vue 3) | `frontweb/` | 3013 | `npm run dev` |

Frontend proxies `/api` and `/static` to backend via Vite config.

### Running Tests

```bash
# Backend tests (Node.js built-in test runner)
cd backend-node && node --test test/*.test.js

# Frontend tests (ESM, Node.js built-in test runner)
cd frontweb && node --test test/*.test.js
```

No ESLint or other lint tool is configured in this codebase.

### Building

```bash
cd frontweb && npm run build
```

### Key Development Notes

- Pure JavaScript (no TypeScript) throughout.
- Backend uses `node --watch` for hot reloading in dev mode (`npm run dev`).
- Database is SQLite (embedded via `better-sqlite3`), auto-created in `backend-node/data/`.
- Migrations run automatically on backend startup (`ensureColumns()`); explicit `npm run migrate` only needed for first-time setup or after adding new migration SQL files.
- Config file at `backend-node/configs/config.yaml` already exists in the repo — no need to copy from example.
- AI content generation requires external API keys (configured via the app's "AI 配置" page), but the app fully functions without them for development/testing purposes.
- The backend also serves the built frontend from `frontweb/dist/` at port 5679 when the dist folder exists; during development, use the Vite dev server at port 3013 instead.

## Continuous development loop (user instruction, 2026-09-17)

- Before every change, read `docs/progress.md`, existing root progress/findings/task plan, relevant full error logs, TODOs, and staged/unstaged git diff. Preserve existing work and do not repeat completed analysis.
- Solve one verifiable subproblem at a time. After changes, run startup verification, available static/type checks, unit tests and applicable smoke tests. This repository is JavaScript with no typecheck script; report that explicitly and use syntax checks plus frontend build.
- Diagnose failures from full logs; try at least two safe remediation approaches before asking the user if still blocked. Do not stop all work for noncritical failures.
- Update `docs/progress.md` after each module with completed work, current errors, next commands and key files. Never claim completion before tests pass.
- Prefer Mock and isolated databases for all regression tests. User authorization on 2026-09-17 allows minimal paid API connectivity/effect tests with controlled cost. Record requests and estimated cost; do not automatically run bulk production or retry paid failures without a bound. Keep secrets and production data out of Git.
