# Sales module

Sale registration for the POS / Sales module (PMS-008). A CASHIER registers a
sale from a cart, stock is deducted First-Expired-First-Out, the sale and its
line items are persisted in a single database transaction, a sequential receipt
number is allocated, and the dashboard is notified in real time via an SSE
stream.

Related tickets:

- [PMS-008-BE #23](https://github.com/RychardGutierrez/openPharmacy/issues/23) — Backend
- [PMS-008-DB #24](https://github.com/RychardGutierrez/openPharmacy/issues/24) — Database

## Domain rules

- Registering a sale requires an open shift for the current user
  (`ShiftsService.validateActiveShift`). Otherwise the request is rejected with
  `409`.
- Only active, non-deleted products can be sold. Otherwise `409
  PRODUCT_INACTIVE`.
- The cart cannot be empty. Otherwise `400 EMPTY_CART`.
- Stock is deducted using the PostgreSQL function
  `pharmacy.fn_deduct_stock_fefo`, which skips expired and voided lots and
  locks the selected lot rows so concurrent sales cannot oversell.
- Every write (shift check, product read, FEFO deduction, sale row, sale_items,
  audit rows) happens inside **one** Prisma transaction at
  `SERIALIZABLE` isolation. If any step fails, everything rolls back and
  inventory is left untouched.
- `sale_items.lot_id` always references the exact lot(s) returned by
  `fn_deduct_stock_fefo` for that line.
- The receipt number is a global zero-padded 8-digit integer
  (`00000001`, `00000002`, …) allocated inside the transaction from a dedicated
  PostgreSQL sequence, so concurrent sales cannot collide on the `UNIQUE`
  constraint.
- Prices are taken from `products.sale_price` at sale time and snapshotted into
  `sale_items.unit_price`.
- `total = subtotal − discount`. A discount above the subtotal is rejected with
  `400 DISCOUNT_EXCEEDS_SUBTOTAL`.
- For `CASH` payments, `cashReceived` must be >= total (`400
  CASH_RECEIVED_BELOW_TOTAL`) and `changeGiven = cashReceived − total`.
- Products that require a prescription (`PRESCRIPTION_ONLY`, `PSYCHOTROPIC`,
  `NARCOTIC`) are currently accepted even when no prescription is attached, but
  a `SALE_RX_MISSING` audit row is written. Hard Rx enforcement is owned by
  PMS-009-BE.

## Endpoints

All routes require a Bearer access token.

| Method | Route | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/sales` | CASHIER, PHARMACIST | Register a sale and deduct stock via FEFO |
| `GET` | `/api/sales` | CASHIER, PHARMACIST | List completed sales (paginated) |
| `GET` | `/api/sales/:id` | CASHIER, PHARMACIST | Get a sale receipt by id |

## Registering a sale

```http
POST /api/sales
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "productId": "f56b2f81-dfad-4f62-a51e-638a3b8b97c1", "quantity": 2 }
  ],
  "paymentMethod": "CASH",
  "cashReceived": 30,
  "discount": 0,
  "prescriptionProductIds": []
}
```

`201 Created`

```json
{
  "id": "d4a2b1c0-...",
  "receiptNumber": "00000001",
  "shiftId": "b7e6c5d4-...",
  "userId": "a1b2c3d4-...",
  "subtotal": 25.0,
  "discount": 0,
  "total": 25.0,
  "paymentMethod": "CASH",
  "cashReceived": 30.0,
  "changeGiven": 5.0,
  "status": "COMPLETED",
  "createdAt": "2026-08-20T23:00:00.000Z",
  "pharmacy": {
    "PHARMACY_NAME": "Farmacia Central",
    "PHARMACY_NIT": "1020304012",
    "PHARMACY_ADDRESS": "Av. 6 de Agosto, La Paz",
    "PHARMACY_PHONE": "+591 2 2440000",
    "RECEIPT_FOOTER": "Gracias por su compra"
  },
  "items": [
    {
      "id": "d4a2b1c0-...-0",
      "productId": "f56b2f81-dfad-4f62-a51e-638a3b8b97c1",
      "productName": "Tylenol REST",
      "lotId": "e5c4b3a2-...",
      "quantity": 2,
      "unitPrice": 12.5,
      "lineTotal": 25.0
    }
  ]
}
```

Request fields:

- `shiftId` — optional. When omitted, the cashier's active shift is used.
- `items[].productId` — UUID of the product to sell.
- `items[].quantity` — positive integer.
- `paymentMethod` — `CASH` / `CARD` / `TRANSFER` / `QR`.
- `discount` — optional decimal, applied to the subtotal.
- `cashReceived` — optional; required for `CASH` and must cover `total`.
- `prescriptionProductIds` — optional list of product ids for which a
  prescription was attached in the UI. Used by the soft Rx audit.

### List sales

```http
GET /api/sales
Authorization: Bearer <token>
```

`200 OK` — paginated shape `{ data, total, page, pageSize, totalPages }`.

### Get a receipt

```http
GET /api/sales/:id
Authorization: Bearer <token>
```

`200 OK` — a single `SaleResponseDto`. `404` when the sale does not exist.

Interactive examples for all endpoints are available in
`src/rest-client/sales.http`.

## Transaction flow

1. Empty-cart check and active-shift validation.
2. `BEGIN` (Prisma `$transaction`, `SERIALIZABLE`).
3. Resolve the shift (must belong to the current user and be `OPEN`).
4. Load and validate products (active, not deleted).
5. For each cart line, call `fn_deduct_stock_fefo` inside the transaction and
   collect the lots actually deducted.
6. Compute `subtotal`, validate `discount`, compute `total`,
   `cashReceived`/`changeGiven`.
7. Allocate the next `receiptNumber` from
   `pharmacy.sale_receipt_number_seq`.
8. Insert the `sales` row and one `sale_items` row per deducted lot.
9. Write `SALE_COMPLETED` (and `SALE_RX_MISSING` when applicable) audit rows.
10. `COMMIT`.
11. After commit, emit `sale.created` via `EventEmitter2`; the dashboard SSE
    stream pushes it to connected clients.

Because the FEFO deduction, the sale rows, and the audit rows share one
transaction, a failure anywhere before commit leaves stock exactly as it was.

## Prescription handling (soft gate)

Categories that require a prescription before sale:

- `PRESCRIPTION_ONLY`
- `PSYCHOTROPIC`
- `NARCOTIC`

For this ticket the sale is still accepted when one of these products is sold
without a prescription, but the service writes a `SALE_RX_MISSING` audit row
listing the affected product ids. Full Rx enforcement and prescription CRUD are
out of scope here and belong to PMS-009-BE.

## Database

### `pharmacy.sales`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `shift_id` | UUID | FK → `auth.shifts.id` |
| `user_id` | UUID | FK → `auth.users.id` (cashier) |
| `receipt_number` | TEXT | UNIQUE, sequential, allocated from a sequence |
| `subtotal` | DECIMAL(12,2) | sum of line totals |
| `discount` | DECIMAL(12,2) | default 0 |
| `total` | DECIMAL(12,2) | `subtotal − discount` |
| `payment_method` | `PaymentMethod` enum | `CASH` / `CARD` / `TRANSFER` / `QR` |
| `cash_received` | DECIMAL(12,2) | default 0 |
| `change_given` | DECIMAL(12,2) | default 0 |
| `status` | `SaleStatus` enum | `COMPLETED` / `CANCELLED` / `REFUNDED` |
| `created_at` | TIMESTAMP | default now |

### `pharmacy.sale_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `sale_id` | UUID | FK → `pharmacy.sales.id` |
| `product_id` | UUID | FK → `pharmacy.products.id` |
| `lot_id` | UUID | FK → `pharmacy.lots.id` (the lot actually deducted) |
| `quantity` | INT | qty taken from that lot |
| `unit_price` | DECIMAL(12,2) | snapshot of `products.sale_price` |
| `line_total` | DECIMAL(12,2) | `quantity × unit_price` |

One `sale_items` row is created per lot used. A single cart line can therefore
produce multiple rows when FEFO splits the quantity across several lots.

### `pharmacy.sale_receipt_number_seq`

PostgreSQL sequence created in the PMS-008 migration:

- `BIGINT`, starts at 1, `NO CYCLE`.
- The migration backfills the sequence position from the highest existing
  numeric `receipt_number` so upgrades continue without collisions.
- Read with `nextval()` inside the sale transaction via
  `SalesRepository.nextReceiptNumberTx`, then zero-padded to 8 digits.

## Module wiring

`SalesModule` imports:

- `ShiftsModule` — active-shift validation (`validateActiveShift`).
- `LotsModule` — `FefoService` (`deductStockInTx`).
- `ConfigModule` — pharmacy header info for the receipt (`getPharmacyInfo`).
- `AuditModule` — `AuditLogRepository` for in-transaction audit rows.

`SalesModule` is imported by `AppModule`. It exports nothing yet; `ReturnsModule`
(PMS-011) is expected to import `SalesService` later for return-eligibility
checks.

## Real-time dashboard update

- After a successful `COMMIT`, `SalesService` emits `sale.created` through the
  global `EventEmitter2`.
- `DashboardModule` registers a `DashboardSaleListener` (`@OnEvent('sale.created')`)
  that pushes the payload into a shared `Subject<MessageEvent>`.
- `DashboardController` exposes `GET /api/dashboard/stream` (`@Sse`) that
  streams those events to connected dashboard clients.
- The emission happens strictly **after** commit, so subscribers only ever see
  persisted sales.

## Audit events

Added to `common/audit/audit-event.ts`:

- `SALE_COMPLETED` — written inside the sale transaction with the sale id,
  receipt number, total, and item count.
- `SALE_RX_MISSING` — written when a prescription-required product is sold
  without an attached prescription.

The FEFO deduction also writes `STOCK_DEDUCTED_FEFO` (defined by PMS-005).

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `EMPTY_CART` | 400 | No items in the request |
| `DISCOUNT_EXCEEDS_SUBTOTAL` | 400 | Discount is larger than the subtotal |
| `CASH_RECEIVED_BELOW_TOTAL` | 400 | Cash payment does not cover the total |
| `SALE_NOT_FOUND` | 404 | Sale id does not exist |
| `INSUFFICIENT_STOCK` | 409 | Not enough active non-expired stock (from FEFO) |
| `PRODUCT_INACTIVE` | 409 | Product is inactive or deleted |
| (generic) | 409 | No open shift for the current user |

## Testing

- Unit tests: `sales.service.spec.ts` and `sales.controller.spec.ts`.
- Covered behavior:
  - One sale item per FEFO lot, referencing the deducted lot.
  - `sale.created` is emitted only after a successful transaction.
  - A failure after FEFO deduction propagates so the caller transaction rolls
    back (no stock change).
  - Empty cart is rejected before a transaction is opened.
- Run with `npm test` in `open-api`.

## Manual verification

Interactive REST Client requests live in `src/rest-client/sales.http`. Start
the API, log in to obtain a token, and step through the requests in order. To
see the live SSE stream, open `GET /api/dashboard/stream` with
`Accept: text/event-stream` and register a sale in another request.