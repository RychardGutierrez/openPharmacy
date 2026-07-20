# Auth Module — PMS-002-BE

Login, JWT access tokens, and rotating refresh tokens for the openPharmacy API.
Implements ticket [`PMS-002-BE`](https://github.com/RychardGutierrez/openPharmacy/issues/5).

## Table of contents

- [Overview](#overview)
- [Endpoints](#endpoints)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Security model](#security-model)
- [Configuration](#configuration)
- [Best practices applied](#best-practices-applied)
- [Testing](#testing)
- [Locked-out behavior](#locked-out-behavior)
- [Future work](#future-work)

---

## Overview

Three HTTP routes under `/api/auth`:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Validate credentials, return access token in body + refresh token in HttpOnly cookie |
| `POST` | `/api/auth/refresh` | public | Rotate the refresh token (old one is revoked) |
| `POST` | `/api/auth/logout` | optional | Revoke the refresh token and clear the cookie |

Every login attempt — success, failure, or lockout — writes exactly one row to `auth.audit_logs`.

---

## Endpoints

### `POST /api/auth/login`

Request:
```json
{ "email": "user@example.com", "password": "correct-password" }
```

Success — `200 OK`:
```json
{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 28800,
  "user": { "id": "uuid", "fullName": "…", "email": "…", "role": "PHARMACIST" }
}
```

Side effect: `Set-Cookie: refresh=<jwt>; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=604800`.

Errors:

| Status | When |
|---|---|
| `400` | DTO validation failed (missing field, bad email format, extra fields) |
| `401` | Wrong email or wrong password |
| `422` | Account is currently locked (`ACCOUNT_LOCKED` code) |
| `429` | Per-IP throttler limit exceeded on this route |

The error response for `401` is identical for unknown email and wrong password to prevent account enumeration.

### `POST /api/auth/refresh`

Reads the refresh cookie. Verifies signature, looks up the hashed `jti` in `auth.refresh_tokens`, and rotates: the old row is marked `revoked_at = now()`, a new row + new JWT are issued.

Success — `200 OK`:
```json
{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 28800,
  "user": { "id": "uuid", "fullName": "…", "email": "…", "role": "PHARMACIST" }
}
```

Errors: `401` if the cookie is missing, the signature is invalid, the `jti` was already revoked, or the underlying user is inactive.

### `POST /api/auth/logout`

Reads the refresh cookie (if any), revokes the matching `jti`, and clears the cookie. Always returns `204 No Content` — never reveals whether the token was valid.

---

## Architecture

```
src/modules/auth/
├── auth.module.ts                # Module wiring, APP_GUARD, APP_FILTER, APP_INTERCEPTOR
├── auth.controller.ts            # 3 HTTP routes, @Throttle on login
├── auth.service.ts               # login / refresh / logout business logic
├── auth.constants.ts             # REFRESH_COOKIE_NAME, RefreshCookieOptions
│
├── strategies/
│   └── jwt.strategy.ts           # passport-jwt: verify + load user
│
├── guards/
│   ├── jwt-auth.guard.ts         # extends AuthGuard('jwt'); @Public() short-circuits
│   └── roles.guard.ts            # reads @Roles(...) metadata, compares to req.user.role
│
├── decorators/
│   └── roles.decorator.ts        # @Roles(UserRole.ADMIN, ...)
│
├── interceptors/
│   └── audit.interceptor.ts      # per-controller timing/log
│
├── repositories/
│   ├── users.repository.ts       # findByEmail, findById, registerSuccessfulLogin,
│   │                             # registerFailedAttempt, setPasswordChangedAt
│   ├── audit-log.repository.ts   # create(record)
│   └── refresh-token.repository.ts  # create / rotate / revoke (hashes jti with sha256)
│
├── dto/
│   ├── login.dto.ts              # { email: IsEmail + lower/trim, password: IsString 1-128 }
│   ├── login-response.dto.ts     # { accessToken, refreshToken, expiresIn, user }
│   ├── refresh-response.dto.ts   # same shape
│   └── user-response.dto.ts      # safe user projection
│
├── interfaces/
│   └── jwt-payload.interface.ts  # JwtPayload {sub, role, iat}, RefreshTokenPayload {sub, jti}
│
├── auth.service.spec.ts          # 12 unit tests
├── auth.controller.spec.ts
└── guards/
    ├── jwt-auth.guard.spec.ts
    └── roles.guard.spec.ts
```

### Request flow

```
HTTP request
  └─> helmet, cookieParser, CORS                  [src/main.ts]
  └─> ThrottlerGuard (per-route @Throttle)        [APP_GUARD via @nestjs/throttler]
  └─> JwtAuthGuard                                 [APP_GUARD — @Public() opts out]
       └─> passport-jwt → JwtStrategy.validate    [re-fetches user from DB]
  └─> RolesGuard                                   [APP_GUARD — reads @Roles()]
  └─> ValidationPipe                               [global — whitelist + forbidNonWhitelisted]
  └─> AuditInterceptor                             [per-controller]
  └─> AuthController method
       └─> AuthService method
            └─> UsersRepository / RefreshTokenRepository / AuditLogRepository
                 └─> PrismaService → PostgreSQL
  └─> AllExceptionsFilter on error                 [APP_FILTER — uniform JSON shape]
```

---

## Data model

Three tables, all in the `auth` schema. Migration: `prisma/migrations/20260712190000_pms_002_be_auth/`.

### `User` (additions only — existing columns preserved)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `failed_attempts` | `INTEGER NOT NULL` | `0` | Consecutive bad-password counter |
| `locked_until` | `TIMESTAMP(3)` | `NULL` | Lockout end timestamp |
| `last_failed_at` | `TIMESTAMP(3)` | `NULL` | Last bad-password attempt |
| `password_changed_at` | `TIMESTAMP(3)` | `NULL` | Invalidates access tokens with `iat` before this |

### `RefreshToken`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users.id` | `ON DELETE CASCADE` |
| `hashed_jti` | `TEXT UNIQUE` | `sha256(jti)`; never the raw jti |
| `expires_at` | `TIMESTAMP(3)` | Mirrors `JWT_REFRESH_TTL` |
| `revoked_at` | `TIMESTAMP(3)?` | Set on rotation or logout |
| `created_at` | `TIMESTAMP(3)` | Default `now()` |
| `replaced_by` | `UUID?` | Set when rotated; allows audit chain |

Indexes on `user_id` and `expires_at`.

### `AuditLog`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID? FK → users.id` | Nullable for unknown-email cases; `ON DELETE SET NULL` |
| `event` | `TEXT` | `LOGIN_SUCCESS` \| `LOGIN_FAIL` \| `LOGIN_LOCKED` \| `REFRESH_SUCCESS` \| `REFRESH_FAIL` \| `LOGOUT` |
| `ip` | `TEXT?` | From `x-forwarded-for` or socket |
| `user_agent` | `TEXT?` | |
| `metadata` | `JSONB?` | Free-form per-event context |
| `created_at` | `TIMESTAMP(3)` | Default `now()` |

Indexes on `(user_id, created_at)` and `(event, created_at)`.

---

## Security model

### Password storage

- **bcrypt** with cost factor `BCRYPT_SALT_ROUNDS` (default 12, ~250 ms on modern CPUs).
- The hash column is never returned to the client (Prisma model only; DTO projection excludes it).
- Passwords are never logged, never included in JWT payloads, never echoed in error messages.

### JWT access token

- Signed with `JWT_ACCESS_SECRET` (HS256), `expiresIn = JWT_ACCESS_TTL` (default `8h`).
- Payload: `{ sub, role, iat }`. No PII beyond `role`.
- Carried as `Authorization: Bearer <token>`.
- The `JwtStrategy.validate` hook re-fetches the user from the DB on every request and rejects if:
  - User is missing, inactive, or soft-deleted
  - `user.password_changed_at` is set and `payload.iat * 1000 < password_changed_at`
    (token issued before the password change → invalid)

### Refresh token

- Signed with a **different** secret (`JWT_REFRESH_SECRET`), `expiresIn = JWT_REFRESH_TTL` (default `7d`).
- Payload: `{ sub, jti }`. `jti` is a UUIDv4.
- Server-side: only the `sha256(jti)` is stored in `auth.refresh_tokens`. A leak of the DB does not yield usable tokens.
- Every successful `/auth/refresh` revokes the old row and issues a new one (rotation). This is the standard defence against refresh-token theft: a stolen token becomes useless the first time the legitimate user refreshes.
- `/auth/logout` revokes the row and clears the cookie. `Set-Cookie` with `Max-Age=0` is the only thing the client sees.

### Cookie

- `Name: refresh`
- `HttpOnly` (not readable from JS), `SameSite=Lax`, `Path=/api/auth` (sent only to auth routes), `Max-Age = 7d`.
- `Secure` is set automatically when `NODE_ENV=production`.

### Account lockout

Per-account policy, separate from the per-IP throttler:

- The first 5 bad-password attempts return `401 Invalid credentials` and increment `failed_attempts`.
- The 5th failure also sets `locked_until = now + 15 minutes` and writes both `LOGIN_FAIL` and `LOGIN_LOCKED` rows.
- Any attempt while `locked_until > now` returns `422 ACCOUNT_LOCKED` (with the remaining minutes in the message) and writes only `LOGIN_LOCKED`.
- A successful login resets `failed_attempts = 0`, `locked_until = null`, `last_failed_at = null`, and updates `last_login`.
- Lockout status is checked **before** bcrypt to avoid wasting CPU on locked accounts.

### Rate limiting

Two layers, both from `@nestjs/throttler`:

- **Global** — three sliding windows per IP: 3 req/s, 20 req/10s, 100 req/min. A request must be under every window.
- **Per-route** — `POST /api/auth/login` is capped at **5 req/min/IP** in addition to the global tiers, on top of the per-account lockout.

### CORS

- `CORS_ORIGIN` (comma-separated) is the only origin(s) allowed.
- `credentials: true` is set so the FE can send the refresh cookie.
- The FE must use `fetch(..., { credentials: 'include' })` or `axios` with `withCredentials: true`.

### Input validation

Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`:

- Unknown properties are stripped (`whitelist`).
- Requests with extra properties are rejected with `400` (`forbidNonWhitelisted`).
- DTOs are class-transformed into the declared types.
- `LoginDto.email` is `@IsEmail + @Transform(lower + trim)` so casing and whitespace don't matter for lookups but do matter for password comparison.

### Error responses

A single `AllExceptionsFilter` is registered as `APP_FILTER`. It returns:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "path": "/api/auth/login",
  "timestamp": "2026-07-12T18:00:00.000Z"
}
```

- 5xx errors are logged with stack trace; 4xx are logged as a single line with the request path.
- The `message` is the safe-to-expose text; internal details never reach the client.

---

## Configuration

All settings come from environment variables, validated at startup with Joi (`src/common/config/validation.schema.ts`). See `.env.example` for the full list with comments.

| Variable | Default | Effect |
|---|---|---|
| `JWT_ACCESS_TTL` | `8h` | Access token lifetime (matches ticket) |
| `JWT_REFRESH_TTL` | `7d` | Refresh token lifetime (matches ticket) |
| `LOCKOUT_MAX_ATTEMPTS` | `5` | Bad attempts before lockout (matches ticket) |
| `LOCKOUT_DURATION_MIN` | `15` | Lockout window in minutes (matches ticket) |
| `BCRYPT_SALT_ROUNDS` | `12` | bcrypt cost factor |
| `THROTTLE_*_TTL` / `THROTTLE_*_LIMIT` | see `.env.example` | Global throttler windows |
| `THROTTLE_LOGIN_*` | `60000` / `5` | Per-IP cap on `/auth/login` |

Missing required vars (e.g., `JWT_ACCESS_SECRET < 32 chars`, `COOKIE_SECRET`) fail the app at startup with a Joi error.

---

## Best practices applied

Mapping the implementation to the `nestjs-best-practices` ruleset:

| Rule | Where |
|---|---|
| `arch-feature-modules` | `auth.module.ts` is self-contained; only imports `UsersRepository` from the same module |
| `arch-single-responsibility` | `AuthService` does auth flows; `UsersService` would own user CRUD; lockout counter is on `User` and written through `UsersRepository` |
| `di-prefer-constructor-injection` | All deps via constructor |
| `error-throw-http-exceptions` | `AuthService` throws `UnauthorizedException`, `UnprocessableEntityException` |
| `error-use-exception-filters` | `AllExceptionsFilter` registered as `APP_FILTER` |
| `error-handle-async-errors` | No fire-and-forget; audit writes inside transactions where appropriate |
| `security-auth-jwt` | Two distinct secrets, short-lived access, server-side refresh store, `validate` re-fetches user, checks `password_changed_at`, minimal payload |
| `security-validate-all-input` | Global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform` |
| `security-use-guards` | `JwtAuthGuard` and `RolesGuard` as `APP_GUARD`; `@Public()` opts out |
| `security-rate-limiting` | `@nestjs/throttler` with three global tiers plus per-route override on login |
| `security-sanitize-output` | `ClassSerializerInterceptor` registered; `UserResponseDto` excludes `passwordHash`/`failed_attempts`/`locked_until` |
| `api-use-dto-serialization` | All responses use explicit DTOs, never Prisma model types |
| `api-use-interceptors` | `AuditInterceptor` for cross-cutting timing; bound to `AuthController` |
| `db-use-migrations` | Schema changes ship via Prisma migration files, never `db push` |
| `db-use-transactions` | `registerSuccessfulLogin` + lockout updates happen in the same Prisma transaction as the credential check |
| `test-use-testing-module` | Unit tests with `Test.createTestingModule` and mocked repos |
| `test-e2e-supertest` | `test/auth.e2e-spec.ts` exercises the 3 acceptance criteria against a real DB |
| `test-mock-external-services` | Prisma client is stubbed in `test/__mocks__/prisma-client-mock.ts` so unit tests don't load the ESM client |
| `devops-use-config-module` | `@nestjs/config` with Joi validation, all secrets in env |
| `devops-use-structured-logging` | Nest's built-in `Logger` with class context, used in service and filter |

---

## Testing

### Unit tests (`src/modules/auth/**/*.spec.ts`)

```
npx jest
```

- `auth.service.spec.ts` — 12 cases: valid creds, unknown email, wrong password, 5th-attempt lockout, locked account, missing refresh, invalid signature, rotation success, revoked refresh, logout with token, logout without token.
- `auth.controller.spec.ts` — module wiring.
- `guards/roles.guard.spec.ts` — metadata reading, role matching, no-user fallback.
- `guards/jwt-auth.guard.spec.ts` — `@Public()` short-circuit, super-call delegation.

The Prisma client is replaced by `test/__mocks__/prisma-client-mock.ts` via `moduleNameMapper` in `package.json`, so unit tests run under CommonJS ts-jest without loading the real ESM client.

### E2E tests (`test/auth.e2e-spec.ts`)

```
DATABASE_URL=postgresql://user:pass@host:5432/db npx jest --config test/jest-e2e.json
```

The suite is **skipped automatically** if `DATABASE_URL` is unset. With a live DB it covers the three acceptance criteria from the ticket:

1. **AC1** — valid credentials return access + refresh cookie with correct 8h/7d expiry.
2. **AC2** — 5 consecutive bad passwords return 401, the 6th returns 422 (locked).
3. **AC3** — every login attempt produces exactly one audit row (pass or fail).

Plus rotation, logout revocation, malformed email, and unknown-email 401.

---

## Locked-out behavior

Timeline for a brute-force attempt against `user@example.com`:

```
attempt 1  bad pwd  → 401   LOGIN_FAIL                  failed_attempts=1
attempt 2  bad pwd  → 401   LOGIN_FAIL                  failed_attempts=2
attempt 3  bad pwd  → 401   LOGIN_FAIL                  failed_attempts=3
attempt 4  bad pwd  → 401   LOGIN_FAIL                  failed_attempts=4
attempt 5  bad pwd  → 401   LOGIN_FAIL + LOGIN_LOCKED   failed_attempts=5, locked_until=now+15m
attempt 6  bad pwd  → 422   LOGIN_LOCKED                counter unchanged
attempt 7  bad pwd  → 422   LOGIN_LOCKED                counter unchanged
…
correct pwd (after 15m) → 200  LOGIN_SUCCESS           failed_attempts=0, locked_until=NULL
```

- The 5th attempt itself still returns `401` (not `422`) — the lock takes effect *after* the response, so the attacker learns nothing about which attempt was the one that locked them out. Subsequent attempts during the lock window return `422`.
- The 422 response includes the remaining minutes: `"Account locked. Try again in N minute(s)."`

---
