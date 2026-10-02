# openPharmacy

openPharmacy is a pharmacy management system for inventory, purchasing, sales,
cash-register shifts, prescriptions, reporting, user administration, and
pharmacy configuration.

The project is split into two applications:

- `openPharmacy/open-api`: NestJS REST API, Prisma data access, PostgreSQL,
  authentication, reporting, and business rules.
- `openPharmacy/open-fronted`: Next.js dashboard and authentication UI.

## Capabilities

- Secure login with JWT access tokens and rotating HttpOnly refresh tokens.
- Role-based access for `ADMIN`, `PHARMACIST`, and `CASHIER` users.
- User administration and self-service profile/password management.
- Product catalog, controlled-product classification, lots, expiry tracking,
  and FEFO stock deduction.
- Purchase orders, suppliers, receiving, inventory movements, and adjustments.
- POS sales, receipts, cancellations, returns, and prescription workflows.
- Cash-register shifts with closing, reconciliation, and reopen requests.
- Dashboard KPIs, low-stock/expiry monitoring, reports, exports, and alerts.
- Pharmacy branches (SEDES), doctors, billing, and system configuration.
- Audit logging for security-sensitive and operational actions.

## Architecture

```text
Browser
  |
  | same-origin /api/* requests
  v
Next.js 16 frontend :3001
  |  Next rewrite using API_URL
  v
NestJS 11 API :3000
  |-- global JWT and role guards
  |-- DTO validation and exception filter
  |-- feature modules and services
  v
Prisma 7 + PostgreSQL 16
```

The frontend uses feature-sliced organization. Each feature keeps its API
functions, React Query hooks, components, and schemas together. The backend is
organized as NestJS feature modules with controllers, services, repositories,
DTOs, and module-specific tests.

## Requirements

- Node.js 20 or newer.
- npm.
- Docker Desktop or Docker Engine with Compose v2.
- PostgreSQL 16, normally provided by the included Docker Compose file.

## Quick Start

### Configure the API

```bash
cd openPharmacy/open-api
cp .env.example .env
npm install
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.
Change `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` before
using the application outside local development.

### Start PostgreSQL and initialize the database

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

The seed creates development users and sample pharmacy data. Seed credentials
are printed by the command and must never be reused in production.

### Start the applications

```bash
cd openPharmacy/open-api
npm run start:dev
```

```bash
cd openPharmacy/open-fronted
npm install
npm run dev
```

The API listens on `http://localhost:3000` and the frontend on
`http://localhost:3001`. The frontend proxies `/api/*` to the API. Set
`API_URL` in `open-fronted/.env.local` when the API runs elsewhere.

## Common Commands

### API

| Command | Purpose |
|---|---|
| `npm run start:dev` | Start NestJS in watch mode |
| `npm run build` | Compile the API |
| `npm run lint` | Lint and autofix API TypeScript |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run prisma:migrate` | Create/apply a development migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run db:up` | Start local PostgreSQL |
| `npm run db:down` | Stop PostgreSQL without deleting data |
| `npm run db:reset` | Destroy and recreate the local database |

### Frontend

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js on port 3001 |
| `npm run build` | Build the production frontend |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Typecheck without emitting files |

## Authentication Summary

- Access tokens are kept in memory in Zustand and sent as Bearer tokens.
- Refresh tokens are HttpOnly cookies scoped to `/api/auth`.
- The frontend uses the readable `op_session` cookie only for fast routing
  decisions; it is not an authorization boundary.
- The backend revalidates the user and role on every protected request.
- Password changes update `password_changed_at` and revoke refresh sessions.
- Failed login attempts use account lockout and request throttling.

See [backend auth documentation](openPharmacy/open-api/src/modules/auth/README.md)
and [frontend auth documentation](openPharmacy/open-fronted/features/auth/README.md).

## Documentation Map

- [Module catalog](MODULES.md): responsibilities, routes, and frontend
  coverage for every application module.
- [API documentation](openPharmacy/open-api/README.md): API setup, commands,
  database, and backend architecture.
- [Frontend documentation](openPharmacy/open-fronted/README.md): dashboard
  setup, feature architecture, and client state conventions.
- [Docker/PostgreSQL guide](openPharmacy/open-api/docker/README.md): local
  database lifecycle and troubleshooting.
- [Design assets](docs/): diagrams, documentation exports, and mockups.

Detailed module READMEs are kept beside the relevant code when available,
including auth, sales, products, shifts, lots, and Docker.

## Database and Development Rules

The Prisma schema is in `openPharmacy/open-api/prisma/schema.prisma`. Apply
schema changes through Prisma migration files. Do not use `prisma db push` for
shared or production environments.

- Keep domain rules in backend services, not controllers or UI components.
- Use DTOs with class-validator for API input and explicit response DTOs.
- Use React Query for server state and Zustand only for client/session state.
- Use React Hook Form and Zod for frontend forms.
- Add or update module documentation when adding endpoints or domain behavior.
- Never commit `.env`, credentials, refresh tokens, or production data.

The included Docker Compose configuration is for local development. Production
deployments should use managed PostgreSQL, external secret management,
automated backups, TLS, restricted CORS origins, and non-default credentials.
