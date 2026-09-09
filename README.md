# Nivo — Work Management

A calm, precise workspace for issues, projects, and cycles. Next.js App Router frontend backed by a Fastify + PostgreSQL API.

## Getting started

```bash
# 1. Start PostgreSQL
docker compose up -d db

# 2. Apply migrations and start the API (port 4000)
npm install          # web dependencies
npm --prefix server install
npm run migrate
npm run dev:server   # Fastify on http://127.0.0.1:4000

# 3. Start the web app (port 3000, proxies /api to the server)
npm run dev
```

The first launch seeds a realistic demo workspace (150 issues, 4 projects, 6 cycles, 12 members).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run dev:server` | Fastify API with watch mode |
| `npm run migrate` | Apply SQL migrations in `server/migrations/` |
| `npm run lint` / `typecheck` / `test` | ESLint, TypeScript, Vitest |
| `npm run build` + `npm start` | Production web server |
| `npm run test:e2e` | Playwright (launches both servers) |

## Architecture

```
Browser ── /api/* ──► Next.js rewrite ──► Fastify (:4000) ──► PostgreSQL
```

- Domain rules live once in `lib/domain/commands.ts` (`applyCommand`). The server loads the workspace snapshot inside a transaction, applies the command, and writes the diff back to normalized tables (`server/src/store.ts`). Revisions and `applied_mutations` provide optimistic-concurrency and idempotent mutations.
- The client keeps its optimistic mutation coordinator; it now persists through `lib/repositories/http.ts` and polls `GET /api/workspace/revision` to refresh when another client commits.
- Schema: normalized tables per entity (`workspaces`, `teams`, `users`, `labels`, `projects`, `project_members`, `cycles`, `issues`, `issue_labels`, `comments`, `activities`, `saved_views`) in `server/migrations/001_init.sql`.
