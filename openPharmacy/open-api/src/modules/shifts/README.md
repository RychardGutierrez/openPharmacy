# Shifts module

Shift open/close and cash-register reconciliation for the Sales / Cash Register
module (PMS-007). A cashier opens a shift before making sales and closes it at
the end of the day so that cash transactions are controlled and daily
reconciliation is possible.

Related tickets:

- [PMS-007-BE #20](https://github.com/RychardGutierrez/openPharmacy/issues/20) — Backend
- [PMS-007-DB #21](https://github.com/RychardGutierrez/openPharmacy/issues/21) — Database

## Domain rules

- One shift per cashier is `OPEN` at a time. Enforced by the database with a
  partial unique index on `auth.shifts (user_id) WHERE status = 'OPEN'`.
- Opening a second shift for a user who already has one open returns `409`.
- Sales registration requires an open shift (`validateActiveShift`).
- Closing recomputes `expectedCash` and `difference` server-side from persisted
  sales. Client-submitted totals are never trusted.
- Only an `ADMIN` can reopen a closed shift.
- A `CASHIER` or `PHARMACIST` may request a reopen; an `ADMIN` reviews it.

## Reconciliation model

On close the API calculates:

```
expectedCash = openingCash + Σ(cash_received) − Σ(change_given)
difference   = expectedCash − closingCash
```

`expectedCash` and `difference` are recomputed from database sales only. The
`closingCash` is the only value the client submits (the physically counted
cash).

> Note: `difference` is currently returned in the close response and is not
> persisted. No `difference` column exists in the schema. Persisting it is an
> open decision.

## Endpoints

All routes require a Bearer access token.

| Method | Route | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/shifts/open` | CASHIER, PHARMACIST | Open a shift |
| `GET` | `/api/shifts/current` | CASHIER, PHARMACIST | Get the current user's open shift, or `null` |
| `GET` | `/api/shifts/mine` | CASHIER, PHARMACIST | List the current user's shifts for history and reopen requests |
| `PATCH` | `/api/shifts/:id/close` | CASHIER, PHARMACIST (owner) | Close a shift and reconcile |
| `POST` | `/api/shifts/:id/reopen-request` | CASHIER, PHARMACIST (owner) | Request a reopen |
| `GET` | `/api/shifts/reopen-requests` | ADMIN | List pending reopen requests |
| `PATCH` | `/api/shifts/reopen-requests/:requestId/approve` | ADMIN | Approve a request and reopen |
| `PATCH` | `/api/shifts/reopen-requests/:requestId/reject` | ADMIN | Reject a request |
| `PATCH` | `/api/shifts/:id/reopen` | ADMIN | Directly reopen a shift |

> Route order matters in the controller: static routes (`reopen-requests`,
> `open`) are declared before parameterized routes to avoid capture by `:id`.

## Request and response examples

### Open a shift

```http
POST /api/shifts/open
Authorization: Bearer <token>

{ "openingCash": 250.00 }
```

`201 Created`

### Close a shift

```http
PATCH /api/shifts/:id/close
Authorization: Bearer <token>

{ "closingCash": 320.50 }
```

`200 OK`

```json
{
  "shift": { "id": "...", "status": "CLOSED" },
  "countedCash": 320.5,
  "expectedCash": 332.0,
  "difference": 11.5
}
```

### Request a reopen

```http
POST /api/shifts/:id/reopen-request
Authorization: Bearer <token>

{ "reason": "The closing cash count was entered incorrectly." }
```

`201 Created`

### List pending requests

```http
GET /api/shifts/reopen-requests
Authorization: Bearer <token>
```

`200 OK`

### Approve / reject a request

```http
PATCH /api/shifts/reopen-requests/:requestId/approve
PATCH /api/shifts/reopen-requests/:requestId/reject
Authorization: Bearer <token>
```

`200 OK`

### Directly reopen (admin override)

```http
PATCH /api/shifts/:id/reopen
Authorization: Bearer <token>
```

`200 OK`. Non-ADMIN users receive `403`.

Interactive examples for all endpoints are available in
`src/rest-client/shifts.http`.

## Database

### `auth.shifts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK → `auth.users.id` |
| `opening_cash` | DECIMAL(12,2) | required |
| `closing_cash` | DECIMAL(12,2) | nullable, set on close |
| `expected_cash` | DECIMAL(12,2) | nullable, computed on close |
| `status` | `ShiftStatus` enum | `OPEN` / `CLOSED`, default `OPEN` |
| `opened_at` | TIMESTAMP | default now |
| `closed_at` | TIMESTAMP | nullable |

Constraints:

- `shifts_one_open_per_user_id_idx` — partial unique index
  `(user_id) WHERE status = 'OPEN'`. Rejects a second open shift per user at the
  database level (ticket #21 acceptance criterion).
- `shifts_user_id_status_idx` — supporting index for active-shift lookups.

### `auth.shift_reopen_requests`

Added for the reopen request/approval workflow (decision outside the original
tickets, requested by the team).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `shift_id` | UUID | FK → `auth.shifts.id` |
| `requested_by` | UUID | FK → `auth.users.id` |
| `reason` | TEXT | required |
| `status` | `ShiftReopenRequestStatus` enum | `PENDING` / `APPROVED` / `REJECTED` |
| `reviewed_by` | UUID | nullable FK → `auth.users.id` |
| `reviewed_at` | TIMESTAMP | nullable |
| `created_at` / `updated_at` | TIMESTAMP | timestamps |

Constraints:

- `shift_reopen_requests_one_pending_per_shift_idx` — partial unique index
  `(shift_id) WHERE status = 'PENDING'`. Only one pending request per shift.
- `shift_reopen_requests_shift_id_status_idx` — supporting index.
- `shift_reopen_requests_requested_by_status_idx` — supporting index.

## Reopen flow

1. `CASHIER` / `PHARMACIST` calls `POST /api/shifts/:id/reopen-request` with a
   reason. Only the shift owner can request.
2. `ADMIN` lists pending requests with `GET /api/shifts/reopen-requests`.
3. `ADMIN` approves (`PATCH .../approve`) or rejects (`PATCH .../reject`).
   - Approve: the shift becomes `OPEN`; `closing_cash`, `expected_cash` and
     `closed_at` are cleared; reconciliation is recomputed on next close.
   - Reject: the request is marked `REJECTED`; the shift stays `CLOSED`.
4. `PATCH /api/shifts/:id/reopen` is the direct admin override. It also marks
   any pending requests for the shift as rejected so no request remains open.

## Behavior details

- **Ownership:** a user can only close or request reopening their own shift
  (`403` otherwise). Approve/reject and direct reopen are ADMIN-only.
- **409 cases:**
  - Second open shift for a user with an open shift.
  - Closing or reopening a shift that is not in the expected state
    (`OPEN` for close, `CLOSED` for reopen).
  - A duplicate pending reopen request for the same shift.
- **Duplicate-request handling:** the partial unique index raises a `P2002`
  violation, which the service translates into `409`.

## Integration with sales

- `ShiftsModule` exports `ShiftsService`.
- `SalesModule` imports `ShiftsModule`.
- `SalesService.create()` calls `ShiftsService.validateActiveShift(userId)`
  before registering a sale. If the cashier has no open shift the request is
  rejected with `409`.
- The sale entity links back to the shift via `Sale.shift_id`, which drives the
  close-time reconciliation query.

## Audit events

Added to `common/audit/audit-event.ts`:

- `SHIFT_OPENED`
- `SHIFT_CLOSED`
- `SHIFT_REOPEN_REQUESTED`
- `SHIFT_REOPENED`
- `SHIFT_REOPEN_REQUEST_REJECTED`

## Testing

- Unit tests: `shifts.service.spec.ts` and `shifts.controller.spec.ts`.
- Acceptance criteria covered:
  - Second open shift for the same user returns `409`.
  - `expectedCash`/`difference` recomputed from persisted sales, never from the
    request body.
  - Non-ADMIN direct reopen returns `403` (via `@Roles(UserRole.ADMIN)`).
  - Sales registration is blocked without an active shift.
- Run with `npm test` in `open-api`.

## Manual verification

Interactive REST Client requests live in `src/rest-client/shifts.http`. Start
the API, log in to obtain a token, and step through the requests in order.
