# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This git root (`D:\Projects\SystemPharmacy`) contains the openPharmacy project. The applications live under `openPharmacy/`:

- `openPharmacy/open-api/`: NestJS 11 REST API, Prisma 7 on PostgreSQL 16.
- `openPharmacy/open-fronted/`: Next.js 16 dashboard (React 19, Tailwind v4, shadcn/ui).

The `docs/` folder holds diagrams, exports, and mockups. `MODULES.md` is the backend/frontend module catalog and the entry point for module-level docs.

`open-fronted/CLAUDE.md` imports `open-fronted/AGENTS.md`, which has frontend-specific rules. Read it before touching the frontend.

## Commands

Run API commands from `openPharmacy/open-api`, and frontend commands from `openPharmacy/open-fronted`.

### API
- Setup: `npm install`, then copy `.env.example` to `.env` (`Copy-Item` on PowerShell). Startup validates env vars with Joi, so missing ones fail fast.
- Database: `npm run db:up` (Docker Compose, `docker/docker-compose.yml`), `npm run db:down`, `npm run db:reset` (drops volumes).
- Prisma: `npm run prisma:generate`, `npm run prisma:migrate` (creates and applies a dev migration), `npm run db:seed`. Use migrations, not `prisma:push`, for anything shared.
- Dev server: `npm run start:dev` (port 3000, with `/api` prefix, Swagger in development).
- Build and lint: `npm run build`, `npm run lint` (ESLint with `--fix`), `npm run format`.
- Unit tests: `npm test`. Spec files are `src/**/*.spec.ts` and run through ts-jest. `npx jest path/to/file.spec.ts` runs a single file, and `npx jest -t "name"` runs a single test by name.
- E2E tests: `npm run test:e2e`. These use `test/jest-e2e.json` (`*.e2e-spec.ts`, one worker) and need the local database running.

### Frontend
- Dev server: `npm run dev` (port 3001). The API must run on port 3000. Override with `API_URL` in `.env.local`.
- Lint and typecheck: `npm run lint`, `npx tsc --noEmit`. There is no test framework, so do not try to run tests.

## Architecture

### Request flow
Browsers call same-origin `/api/*`. The Next.js rewrite in `next.config.ts` forwards those calls to the NestJS API (`API_URL`), so there is no CORS between browser and frontend. The frontend has no database access. All business logic lives in the API.

### API cross-cutting behavior (`src/main.ts`, `src/app.module.ts`)
- Every route is under the `/api` prefix and is protected by global JWT and role guards unless marked public. Role checks use the `@Roles()` decorator and `RolesGuard`.
- A global `ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`, so unknown fields are rejected. Input goes through DTOs with class-validator, and responses use `@Exclude()` via `ClassSerializerInterceptor`.
- Shared infrastructure lives in `src/common/` (audit, config, mailer, filters, decorators) and `src/prisma/`. Business modules live in `src/modules/<name>/` and each usually has a controller, service, repositories, DTOs, and specs. Module READMEs (for example `modules/auth/README.md` and `modules/sales/README.md`) hold the detailed invariants. Read them before changing those areas.
- Prisma's client is mocked for unit tests through `moduleNameMapper` in `package.json` (`test/__mocks__/prisma-client-mock.ts`).

### Business rules that span modules
- **Sales** requires an open cash shift (`shifts`). It deducts stock by FEFO (first-expiry-first-out) through the `lots` module, writes receipts and items in one transaction, and emits controlled-product compliance signals. Returns restore inventory through the same services. Changes to sales usually also touch `lots`, `shifts`, and `prescriptions`.
- **Inventory** changes go through `lots`, `inventory-movements`, `purchase-orders` (receiving), and `sales`. Do not write stock directly from other modules.
- **Auth** uses short-lived JWT access tokens and rotating refresh tokens stored as hashed JTIs. The refresh cookie is HttpOnly and scoped to `/api/auth`. Every protected request re-validates the user and role. Password changes revoke sessions.
- **Reports** can generate synchronously or through a queued worker (`REPORT_WORKER_ENABLED`), and download links are signed. **Dashboard** pushes live sale events over SSE.

### Frontend structure
- `app/` is the App Router, with route groups `(auth)` and `(dashboard)`. `(dashboard)` is wrapped by `core/guards/AuthGuard`.
- `features/<name>/` is feature-sliced. Each feature keeps its `api/` (fetch wrappers and React Query hooks), `components/`, `hooks/`, `store/`, and `types.ts` (Zod response schemas and form validation) together.
- Session state: the access token lives only in memory (Zustand, `features/auth/store/auth-store.ts`). The `op_session` cookie is readable and only drives redirects in `proxy.ts`. It is not an authorization boundary.
- Server state uses TanStack Query. Invalidate the related query keys after mutations.
- `@/*` maps to the frontend root, not `src/`.

### Frontend version warning
Next.js 16 and Tailwind v4 differ from older versions. Before writing Next-specific code, read the relevant guide in `openPharmacy/open-fronted/node_modules/next/dist/docs/`, as `open-fronted/AGENTS.md` requires.

## Conventions
- Keep domain rules in backend services, not controllers or React components.
- When you add or change an endpoint or domain behavior, update that module's README and `MODULES.md` if needed.
- Never commit `.env` files, credentials, tokens, or production data. `.agents/` and `skills-lock.json` are gitignored in both apps.
