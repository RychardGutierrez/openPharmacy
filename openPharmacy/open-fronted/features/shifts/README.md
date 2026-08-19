# Shifts

Cash-register shift opening, closing, reconciliation preview, and reopen-request workflows.

## Backend integration

The feature calls the implemented endpoints under `/api/shifts`:

- `POST /shifts/open`
- `GET /shifts/current`
- `GET /shifts/mine`
- `PATCH /shifts/:id/close`
- `POST /shifts/:id/reopen-request`
- `GET /shifts/reopen-requests` (ADMIN)
- `PATCH /shifts/reopen-requests/:requestId/approve` (ADMIN)
- `PATCH /shifts/reopen-requests/:requestId/reject` (ADMIN)
- `PATCH /shifts/:id/reopen` (ADMIN direct override)

The API returns Prisma shift fields in snake_case and decimal values as strings. `types.ts` normalizes those responses to the frontend camelCase model and numeric BOB values at the API boundary.

## Known backend limitations

- The current shift is synchronized from `GET /shifts/current` and mirrored in session-scoped Zustand state, persisted to `sessionStorage` under `op_open_shift`.
- The backend calculates final expected cash only when closing. The close card therefore displays opening cash as `Efectivo esperado (provisional)` and uses it for the live preview. The server response remains authoritative for final reconciliation.
- The sales module does not expose working cash/card aggregation yet. Cash sales are shown as zero and card sales as `—` with explanatory tooltip.
- The Z-Report is a local printable summary, not a backend-generated regulatory report.
- After closing, the cashier can request reopening for the just-closed shift. There is no endpoint to list that cashier's historical or pending requests, so pending state is displayed for the current browser flow; duplicate submissions are still rejected by the backend.

## Structure

- `types.ts`: Zod response and form schemas.
- `api/`: fetch functions, React Query hooks, and mutation invalidation.
- `store/shift-store.ts`: session-scoped active shift state.
- `components/`: cashier cards, print report, reopen dialog, and ADMIN review table.
- `app/(dashboard)/sales/cash-register/page.tsx`: cashier-facing route.
- `app/(dashboard)/admin/reopen-requests/page.tsx`: ADMIN review route.
