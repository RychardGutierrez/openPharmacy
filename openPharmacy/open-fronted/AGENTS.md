<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

| Task       | Command                        |
|------------|--------------------------------|
| Dev server | `npm run dev`                  |
| Build      | `npm run build`                |
| Lint       | `npm run lint`                 |
| Typecheck  | `npx tsc --noEmit`             |
| Add UI     | `npx shadcn@latest add <name>` |

No test framework is configured. Do not attempt to run tests.

## Toolchain gotchas

- **Next.js 16** — read `node_modules/next/dist/docs/` before using any Next API.
- **Tailwind CSS v4** — no `tailwind.config.js`. Config lives in `app/globals.css` via `@theme inline`. Use `@import "tailwindcss"` syntax, not `@tailwind` directives.
- **shadcn/ui v4** (radix-nova style) — components in `components/ui/`, CSS-variable theme in `globals.css`. Base color: `neutral`, accent: `subtle`.
- **Path alias** `@/*` maps to project root (not `src/`). shadcn utils at `@/lib/utils` (`cn()` helper).

## Architecture

Feature-sliced design. Each feature in `features/<name>/` follows:

```
features/<name>/
  api/         # API calls / React Query hooks
  components/  # Feature-scoped components
  hooks/       # Feature-scoped hooks
  store/       # Zustand slices
  types.ts     # Feature types
```

Other boundaries:
- `app/` — Next.js App Router. Route groups: `(auth)/`, `(dashboard)/`
- `core/` — Cross-cutting: `config/`, `guards/`, `middleware.ts`, `providers/`
- `shared/` — Reusable: `constants/`, `hooks/`, `utils/`
- `components/ui/` — shadcn primitives only
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)

## State & forms

- **Server state**: TanStack React Query (`@tanstack/react-query`)
- **Client state**: Zustand
- **Forms**: React Hook Form + Zod v4 validation (`@hookform/resolvers`)
- **Tables**: TanStack React Table

## Workspace context

This is the frontend (`open-fronted`). The NestJS backend lives in sibling `../open-api/`. The git root is two levels up at `D:\Projects\SystemPharmacy`.
