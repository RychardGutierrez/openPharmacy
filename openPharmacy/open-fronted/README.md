# openPharmacy Frontend

Next.js 16 dashboard for the openPharmacy pharmacy management system. It
provides protected workflows for sales, inventory, purchasing, shifts,
reporting, administration, and the user profile.

## Setup

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3001`. The API is expected at
`http://localhost:3000`; override it with `API_URL` in `.env.local`:

```env
API_URL=http://localhost:3000
```

The Next.js rewrite proxies browser requests from `/api/*` to the API, so the
browser does not need direct cross-origin access.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server on port 3001 |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Typecheck without emitting files |

## Architecture

```text
app/                 Next.js App Router routes and layouts
components/ui/       shadcn/ui primitives
core/                guards, navigation, providers, shared shell
features/<module>/   API calls, hooks, components, stores, types
shared/              reusable hooks, constants, and utilities
```

Feature modules use:

- TanStack React Query for API/server state.
- Zustand for in-memory session and focused client state.
- React Hook Form and Zod v4 for form validation.
- Same-origin `/api/*` calls with the access token in memory.

## Authentication

The access token is stored only in memory and attached to API requests as a
Bearer token. The refresh token is an HttpOnly cookie managed by the backend.
`AuthGuard` restores sessions on page load, while `proxy.ts` only performs a
fast route redirect based on the `op_session` flag cookie.

See [the auth feature documentation](features/auth/README.md) and the
[project module catalog](../../MODULES.md).

## Main Routes

| Route | Purpose |
|---|---|
| `/dashboard` | KPIs and operational overview |
| `/sales/pos` | Register sales |
| `/sales/cash-register` | Manage cashier shifts |
| `/inventory/products` | Product catalog |
| `/inventory/lots` | Lots and stock |
| `/purchasing/orders` | Purchase orders and receiving |
| `/reports` | Report preview and exports |
| `/users` | Admin user management |
| `/profile` | Current user details and password |
| `/settings` | Admin pharmacy configuration |

## Development Notes

- Keep API boundary validation in each feature's `types.ts` and API wrapper.
- Invalidate related React Query keys after mutations.
- Do not persist access tokens in localStorage, sessionStorage, or readable
  cookies.
- Preserve the existing feature-sliced structure when adding screens.
