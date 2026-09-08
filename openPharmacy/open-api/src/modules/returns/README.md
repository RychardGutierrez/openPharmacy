# Returns module

Customer returns and operational sale cancellations for the POS / Sales
module (PMS-010). A `PHARMACIST` or `ADMIN` can register a return against
a previously completed sale; stock is restored to the exact original lot
recorded on `sale_items`, an `inventory_movement` row of type `RETURN` is
written per affected lot, and one `RETURN_COMPLETED` audit row is
appended. A separate cancellation endpoint on `SalesController`
(`POST /api/sales/:id/cancel`) reverses a complete sale with `CANCELLATION`
movements and flips the sale status to `CANCELLED`.

Related tickets:

- [PMS-010-BE #29](https://github.com/RychardGutierrez/openPharmacy/issues/29) — Backend
- [PMS-010-DB #30](https://github.com/RychardGutierrez/openPharmacy/issues/30) — Database

## Domain rules

- Only authenticated `ADMIN` or `PHARMACIST` users may authorise a return
  or a cancellation. `CASHIER` is rejected with `403`.
- The original sale must exist and be `COMPLETED`. `CANCELLED` and
  `REFUNDED` sales return `409 RETURN_SALE_NOT_ELIGIBLE` /
  `SALE_ALREADY_CANCELLED`.
- `return_items.lot_id` always equals the `lot_id` recorded on the
  referenced `sale_items` row. The service derives it from the locked
  `sale_items` row; the client cannot override it. A composite foreign
  key on `return_items(sale_item_id, lot_id) → sale_items(id, lot_id)`
  enforces this at the database boundary.
- Any `saleItemId` that does not belong to the supplied `saleId` is
  rejected with `400 RETURN_SALE_ITEM_MISMATCH` before any state change.
- The requested refundable quantity per sale item cannot exceed the
  remaining refundable quantity (`saleItem.quantity − sum(return_items)`).
  Over-returns return `400 RETURN_QUANTITY_EXCEEDED`.
- Products with category `PSYCHOTROPIC` or `NARCOTIC` are rejected with
  `403 CONTROLLED_PRODUCT` at the API layer regardless of UI state.
  `PRESCRIPTION_ONLY` returns are allowed.
- A successful return writes:
  - one `pharmacy.returns` row,
  - one `pharmacy.return_items` row per requested sale item,
  - one `pharmacy.inventory_movements` row of type `RETURN` per
    **distinct lot** that received restored stock,
  - one `auth.audit_logs` row with `event = RETURN_COMPLETED`.
- A successful full return (`returnType: FULL` whose total quantity
  covers the sale) flips `sales.status` to `REFUNDED`.
- Cancellation refuses to proceed when the sale already has a return
  record (`409 SALE_HAS_RETURNS`) so we never create duplicate reversal
  movements.

## Transaction flow

1. Open a `SERIALIZABLE` Prisma transaction.
2. `SELECT … FOR UPDATE` the `sales` row to serialise concurrent
   returns / cancellations on the same sale.
3. Load the sale with its line items and the product category.
4. `SELECT … FOR UPDATE` the requested `sale_items` rows so concurrent
   returns cannot race against the cumulative return quantity.
5. Validate eligibility: status, ownership of every `saleItemId`,
   remaining quantity, and category of every affected product.
6. Create the `returns` row, the `return_items` rows, then
   `UPDATE pharmacy.lots SET current_qty = current_qty + …` and the
   `RETURN` movement rows.
7. For `FULL` returns that cover the whole sale, set `sales.status` to
   `REFUNDED`.
8. Write one `RETURN_COMPLETED` audit row.
9. `COMMIT`. Any failure rolls everything back, leaving stock and audit
   data unchanged.

## Endpoints

| Method | Route | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/returns` | ADMIN, PHARMACIST | Register a customer return |
| `POST` | `/api/sales/:id/cancel` | ADMIN, PHARMACIST | Cancel a completed sale |

### Register a return

```http
POST /api/returns
Authorization: Bearer <token>
Content-Type: application/json

{
  "saleId": "d4a2b1c0-...",
  "reason": "Customer returned unopened product",
  "returnType": "PARTIAL",
  "items": [
    { "saleItemId": "b7e6c5d4-...", "quantity": 1 }
  ]
}
```

`201 Created`

```json
{
  "id": "f56b2f81-...",
  "saleId": "d4a2b1c0-...",
  "userId": "a1b2c3d4-...",
  "reason": "Customer returned unopened product",
  "returnType": "PARTIAL",
  "createdAt": "2026-08-30T18:00:00.000Z",
  "items": [
    {
      "id": "e5c4b3a2-...",
      "saleItemId": "b7e6c5d4-...",
      "productId": "f56b2f81-...",
      "lotId": "11111111-1111-1111-1111-111111111111",
      "lotNumber": "PAR-2027-B",
      "quantity": 1
    }
  ]
}
```

Request fields:

- `saleId` — UUID of the original `COMPLETED` sale.
- `reason` — free-text note (3–500 chars) saved on the return row and in
  the audit log.
- `returnType` — `FULL` or `PARTIAL`.
- `items[].saleItemId` — UUID of the original `sale_items` row to refund.
- `items[].quantity` — positive integer ≤ remaining refundable quantity.

### Cancel a sale

```http
POST /api/sales/d4a2b1c0-.../cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Duplicate sale recorded"
}
```

`200 OK`

```json
{
  "id": "cancel-d4a2b1c0-...",
  "saleId": "d4a2b1c0-...",
  "userId": "a1b2c3d4-...",
  "reason": "Duplicate sale recorded",
  "returnType": "FULL",
  "createdAt": "2026-08-30T18:00:00.000Z",
  "items": [
    {
      "id": "cancel-11111111-1111-1111-1111-111111111111",
      "saleItemId": "",
      "productId": "f56b2f81-...",
      "lotId": "11111111-1111-1111-1111-111111111111",
      "lotNumber": "PAR-2027-B",
      "quantity": 2
    }
  ]
}
```

## Database safeguards

The PMS-010 migration:

- Adds the `CANCELLATION` value to the `pharmacy.MovementType` enum.
- Adds a composite foreign key from
  `return_items(sale_item_id, lot_id) → sale_items(id, lot_id)` so the
  lot identity cannot drift between the return and the original sale
  item.
- Adds a `quantity > 0` check on `return_items`.
- Adds an index on `return_items.sale_item_id` to speed up the cumulative
  return aggregation.

## Audit events

Added to `common/audit/audit-event.ts`:

- `RETURN_COMPLETED` — written inside the return transaction with the
  return id, sale id, return type, and per-item saleItem / lot / quantity.
- `SALE_CANCELLED` — written inside the cancellation transaction with the
  sale id, reason, and movement count.

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `RETURN_ITEMS_MISSING` | 400 | One or more `saleItemId`s do not exist |
| `RETURN_SALE_ITEM_MISMATCH` | 400 | `saleItemId` does not belong to `saleId` |
| `RETURN_QUANTITY_EXCEEDED` | 400 | Requested quantity exceeds the remaining refundable quantity |
| `SALE_ALREADY_CANCELLED` | 409 | Sale is not in `COMPLETED` status |
| `SALE_HAS_RETURNS` | 409 | Sale already has a return record; resolve it first |
| `RETURN_SALE_NOT_ELIGIBLE` | 409 | Sale is not eligible for return |
| `CONTROLLED_PRODUCT` | 403 | PSYCHOTROPIC / NARCOTIC return or cancellation rejected |

## Testing

- Unit tests: `returns.service.spec.ts` and `returns.controller.spec.ts`.
- Covered behavior:
  - Stock restored to the original `sale_items.lot_id`.
  - Exactly one `RETURN` movement per affected lot.
  - Exactly one `RETURN_COMPLETED` audit row per return.
  - Controlled-substance lines return 403.
  - Over-quantity returns return 400.
  - Full return flips the sale status to `REFUNDED`.
  - Cancellation refuses returns and refund races.
  - Controlled-substance cancellation return 403.
- Run with `npm test` in `open-api`.

## Manual verification

Interactive REST Client requests live in
`src/rest-client/return_cancellation.http`. Log in, register a sale via
`sales.http`, then walk through the returns and cancellation scenarios in
order.
