# Auth Feature

Client-side authentication for OpenPharmacy. JWT-based with HttpOnly refresh cookies, in-memory access tokens, and a three-layer session lifecycle.

## Directory Structure

```
features/auth/
├── api/
│   ├── auth-api.ts        # Low-level fetch wrappers (login, refresh, logout)
│   ├── constants.ts       # User-facing error messages
│   ├── use-login.ts       # React Query mutation for login
│   └── use-session.ts     # React Query hook for session restoration
├── components/
│   ├── brand-panel.tsx    # Split-screen brand half on login page
│   └── login-form.tsx     # Email/password form with validation
├── hooks/                 # (reserved for future auth hooks)
├── store/
│   └── auth-store.ts      # Zustand store (user, accessToken, status)
└── types.ts               # Zod schemas + TypeScript types
```

## Architecture

### Token Model

| Token | Storage | Lifetime | Scope |
|-------|---------|----------|-------|
| Access token | In-memory (Zustand) | ~15 min | Every API call via `Authorization: Bearer` |
| Refresh token | HttpOnly cookie | 7 days | `Path=/api/auth` only (invisible to JS) |
| `op_session` flag | Regular cookie | 7 days | `Path=/` (readable by `proxy.ts`) |

The access token is **never** written to localStorage or cookies — it lives only in the Zustand store and is cleared on tab close or logout.

### Session Lifecycle

```
┌─────────────┐     POST /api/auth/login      ┌──────────────┐
│  Login form  │ ──────────────────────────────>│  NestJS API   │
│  (useLogin)  │ <──────────────────────────────│  (backend)    │
└─────────────┘  { accessToken, user }         └──────────────┘
       │                  │
       │                  │  HttpOnly refresh cookie set by backend
       │                  │  op_session flag cookie set by client
       ▼                  ▼
┌─────────────────────────────┐
│  auth-store (Zustand)       │
│  { user, accessToken,       │
│    status: "authenticated" }│
└─────────────────────────────┘
       │
       │  On page reload / new tab
       ▼
┌─────────────┐     POST /api/auth/refresh     ┌──────────────┐
│ useSession   │ ──────────────────────────────>│  NestJS API   │
│ (AuthGuard)  │ <──────────────────────────────│  (backend)    │
└─────────────┘  { accessToken, user }         └──────────────┘
       │
       │  On failure (expired/revoked refresh)
       ▼
┌─────────────┐
│ redirect to  │
│ /login       │
└─────────────┘
```

### Three-Layer Protection

1. **`proxy.ts` (edge middleware)** — Fast UX redirect. Reads the `op_session` flag cookie to decide whether to send unauthenticated users to `/login` or authenticated users away from it. This is **not** a security boundary; the refresh cookie is scoped to `/api/auth` and invisible here.

2. **`AuthGuard` (client component)** — Real enforcement for `(dashboard)` routes. Calls `useSession()` on mount, which exchanges the refresh cookie for a fresh access token. Until resolved, children are hidden (spinner shown). On failure, redirects to `/login?from=<path>`.

3. **Backend JWT validation** — Every API call carries the access token in the `Authorization` header. The NestJS backend validates it independently. This is the ultimate security boundary.

## File Reference

### `types.ts`

Zod schemas that define the auth contract:

- `authUserSchema` — Safe user projection: `{ id, fullName, email, role }`
- `authResponseSchema` — Shape of login/refresh responses: `{ accessToken, expiresIn, user }`
- `loginSchema` — Client-side form validation (email + password)
- `USER_ROLES` — `["ADMIN", "PHARMACIST", "CASHIER"]`

### `store/auth-store.ts`

Zustand store with three pieces of state:

- `user: AuthUser | null` — Current user projection
- `accessToken: string | null` — In-memory only, never persisted
- `status: "unknown" | "authenticated" | "unauthenticated"` — Neutral initial value so SSR and client HTML match

Actions:
- `setSession(response)` — Writes user + token to store, sets `op_session` cookie
- `clearSession()` — Clears store, removes `op_session` cookie

### `api/auth-api.ts`

Low-level fetch layer. All calls go through the Next.js rewrite proxy (`/api/*` → NestJS), so no CORS.

- `login(values)` — `POST /api/auth/login` with email/password
- `refreshSession()` — `POST /api/auth/refresh` (sends refresh cookie automatically)
- `logout()` — `POST /api/auth/logout` (best-effort, errors swallowed)

Security measures:
- **Anti-enumeration**: 401 responses always return the same generic message regardless of whether the email or password was wrong
- **Runtime validation**: All responses parsed through `authResponseSchema` at the client boundary
- **Network resilience**: Fetch failures (DNS, CORS, offline) throw a generic error, never leak internals

### `api/use-login.ts`

Thin React Query mutation wrapping `login()`. On success, calls `setSession()` to populate the store.

### `api/use-session.ts`

React Query hook that restores the session on first mount:

- Only fires when `status === "unknown"` (first load)
- `retry: false` — No silent retries; a failed refresh means the user must re-authenticate
- `staleTime: Infinity` — The query never re-fetches within the same tab
- React Query deduplicates concurrent calls, which is critical because the backend rotates refresh tokens (parallel calls would invalidate each other)

Race-condition guard: when the query errors, `clearSession()` is only called if `status === "unknown"`. If the user logged in while the refresh request was still in flight, `status` is already `"authenticated"` and the hook must not wipe the fresh session.

### `components/login-form.tsx`

Full login form with:
- React Hook Form + Zod validation
- Password visibility toggle
- Loading state with spinner
- Error display via `Alert` component
- Open-redirect guard (`safeRedirectPath` only allows same-origin paths)
- Auto-redirect on successful auth (via `useSession` status check)

### `components/brand-panel.tsx`

Server-rendered brand half of the split-screen login page. Deterministic (no random values) so SSR and client HTML always match. Lists the system's feature modules.

## Route Protection Flow

```
User visits /dashboard
        │
        ▼
  proxy.ts checks op_session cookie
        │
   ┌────┴────┐
   │ missing │ present
   ▼         ▼
/login    AuthGuard renders
           │
           ▼
     useSession() fires
     POST /api/auth/refresh
           │
     ┌─────┴─────┐
     │ success   │ failure
     ▼           ▼
  children    redirect to
  rendered    /login?from=/dashboard
```

## Login Flow

```
1. User enters email + password
2. Zod validates form client-side
3. useLogin mutation fires POST /api/auth/login
4. Backend validates credentials, sets HttpOnly refresh cookie
5. Response: { accessToken, expiresIn, user }
6. setSession() stores token + user in Zustand, sets op_session cookie
7. LoginForm detects status === "authenticated"
8. router.replace(from ?? "/dashboard")
```

## Logout Flow

```
1. User clicks "Sign out" in NavUser dropdown
2. logout() fires POST /api/auth/logout (best-effort)
3. clearSession() clears Zustand store + removes op_session cookie
4. AuthGuard detects status === "unauthenticated"
5. router.replace("/login?from=<current-path>")
```

The redirect is handled by `AuthGuard` rather than `NavUser` itself. This avoids double navigation and keeps the logout handler resilient even if the dropdown menu is unmounted mid-click. The `NavUser` component lives in `core/components/nav-user.tsx` but consumes this feature's `logout()` and `clearSession()`.

## Security Decisions

| Decision | Rationale |
|----------|-----------|
| Access token in memory only | XSS cannot steal tokens from localStorage |
| Refresh token in HttpOnly cookie | JS cannot read it; only sent to `/api/auth` path |
| `op_session` as a separate flag cookie | `proxy.ts` needs a readable cookie for fast redirects without touching the refresh token |
| Anti-enumeration on 401 | Prevents attackers from discovering valid email addresses |
| Runtime Zod validation on responses | Catches malformed API payloads before they reach components |
| No token in URL params | Tokens never appear in browser history or server logs |
| `credentials: "include"` on all auth calls | Ensures cookies are sent/received for the refresh token flow |
