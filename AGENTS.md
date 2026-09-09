# Nivo development conventions

- Next.js App Router, React, strict TypeScript, Tailwind CSS, Zustand. Persistence lives in a separate Fastify + PostgreSQL service under `server/` (see "Backend" below). Use npm and preserve `package-lock.json`.
- `npm run dev` starts Next.js. `npm run typecheck` generates route types and runs TypeScript. `npm run lint` runs ESLint independently of the build.
- `npm test` runs Vitest unit/component tests. `npm run test:e2e` runs Playwright against a local development server. For production verification, run `npm run build`, then `npm run test:e2e` without an existing development server on port 3000.

## Backend

- Start PostgreSQL: `docker compose up -d db`. Apply migrations: `npm run migrate`. Start the API: `npm run dev:server` (port 4000; `DATABASE_URL`, `PORT`, `HOST` env vars, see `.env.example`).
- The Next.js app proxies `/api/*` to the API via `next.config.ts` rewrites; `NIVO_API_URL` overrides the target.
- The frontend talks to the API through `lib/repositories/http.ts` implementing `WorkspaceRepository`. All domain rules run in `lib/domain/commands.ts` — the server loads the snapshot inside a transaction (`SELECT … FOR UPDATE`), calls `applyCommand`, and persists the diff to normalized tables in `server/src/store.ts`. Do not duplicate command rules in SQL.
- `server-store.test.ts` runs only when `NIVO_TEST_DATABASE_URL` points at a scratch database.
- Playwright launches both servers automatically (API on :4000, web on :3000); E2E runs with `workers: 1` because tests share one workspace revision.
- Playwright browser setup: `npx playwright install chromium`. Test artifacts are ignored in `test-results/` and `playwright-report/`.
- npm 10.9.2 encountered an Arborist `edgesOut` peer-resolution error while installing Vitest. The same dependency installation succeeded with `npx --yes npm@11.10.1 install ...`, without changing global npm or relaxing peer/security checks.
- Entity interfaces are shared in `types/domain.ts`. Views use the workspace provider and domain selectors; mutations go through the shared transactional service. Do not persist another copy of business records in UI state/localStorage.
- The only custom global keyboard shortcut in the first iteration is Cmd/Ctrl+K. Keep standard keyboard accessibility; do not add C, Q, J/K, E, A, S, P, or Cmd/Ctrl+P shortcuts.
- Do not create placeholder routes/buttons for deferred timeline/calendar/analytics/settings features.
- New tooling configuration belongs in `.devin/` when needed. Do not add code comments unless explicitly requested.
