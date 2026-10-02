# openPharmacy API

NestJS 11 backend for the openPharmacy pharmacy management system. It exposes
the REST API under `/api`, applies authentication and role guards globally, and
uses Prisma 7 with PostgreSQL.

## Responsibilities

- Authentication, authorization, refresh-session rotation, and audit logging.
- Pharmacy and inventory domain services.
- Transactional sales, FEFO stock deduction, returns, and purchasing.
- Dashboard data, alerts, reports, exports, and email notifications.
- DTO validation, structured error responses, throttling, and security headers.

See the [module catalog](../../MODULES.md) for the complete module list.

## Setup

```bash
npm install
Copy-Item .env.example .env # PowerShell; use cp on macOS/Linux
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run start:dev
```

The API defaults to `http://localhost:3000`. The complete environment
reference is in `.env.example`; startup validates required variables with Joi.

## Commands

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run prisma:studio
npm run db:logs
```

## Source Layout

```text
src/
  common/       cross-cutting configuration, audit, filters, mailer
  modules/      business feature modules
  prisma/       Prisma service and module
  main.ts       HTTP bootstrap and global middleware
prisma/
  schema.prisma database schema
  migrations/   versioned database changes
  seed.ts       local development data
```

## Security Defaults

- JWT access tokens and separately signed rotating refresh tokens.
- HttpOnly, SameSite refresh cookie scoped to `/api/auth`.
- Global validation with whitelist and forbidden unknown properties.
- Account lockout and request throttling on authentication routes.
- Passwords hashed with bcrypt and never returned in response DTOs.
- Role checks through `@Roles()` and a global `RolesGuard`.
- Audit events for authentication and critical domain operations.

For the complete authentication design, see
[modules/auth/README.md](src/modules/auth/README.md).
