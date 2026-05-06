# AGENTS.md

## Architecture

Two-package repo, no monorepo tooling:

- **`api/`** — Go 1.25 + Echo v4, SQLite3, OpenAPI codegen
- **`webui/`** — Next.js 16 (App Router), React 19, pnpm 10, Tailwind CSS v4

Single OpenAPI spec at root (`openapi.yaml`) is the contract between them.

## Commands

### API (`api/`)

```sh
make generate   # oapi-codegen → gen/api.gen.go (MUST run after openapi.yaml changes)
make build      # → bin/api
make run        # go run . (port 8080, DB: ika.db)
make tidy       # go mod tidy
```

Env vars: `PORT` (default 8080), `DB_PATH` (default `ika.db`).

### WebUI (`webui/`)

```sh
pnpm install
pnpm dev        # port 3000
pnpm build
pnpm lint       # ESLint 9
```

## Codegen — Critical

`api/gen/api.gen.go` is **auto-generated** by `oapi-codegen` from `openapi.yaml`. Never edit it directly. After changing `openapi.yaml`:

1. `cd api && make generate`
2. Update `api/handler/handler.go` to satisfy any new/changed interfaces
3. Update `webui/src/lib/api.ts` and `webui/src/types/league.ts` manually (no client codegen)

## DB

SQLite3 with schema embedded via `//go:embed schema.sql` in `api/db/db.go`. Tables auto-created on startup (`CREATE TABLE IF NOT EXISTS`). No migration tool — schema changes require manual SQL evolution and restart.

## CORS

API allows `http://localhost:3000` only. Both servers must run for local dev.

## Conventions

- WebUI path alias: `@/*` → `./src/*`
- `.npmrc`: `shamefully-hoist=true` (required for pnpm)
- No CI, no tests, no formatter config currently exist
- Teams have exactly 4 members (enforced by API spec)
- UI design specs live in `plan/`
