# Lots Module

Batch-level inventory, expiry, traceability, and FEFO stock operations.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/lots` | Create a lot or receive stock |
| `GET` | `/api/lots` | List lots with filters |
| `GET` | `/api/lots/product/:productId` | List lots for a product |
| `GET` | `/api/lots/expiry-dashboard` | Summarize expiring and expired lots |
| `GET` | `/api/lots/:id` | Read lot details |
| `GET` | `/api/lots/traceability/:lotNumber` | Search lot traceability |
| `PATCH` | `/api/lots/:id` | Update lot metadata |
| `PATCH` | `/api/lots/:id/void` | Void a lot |
| `POST` | `/api/lots/fefo/deduct` | Deduct stock using FEFO |

## Invariants

- Expired and voided lots are excluded from sale deduction.
- FEFO chooses the earliest eligible expiry and locks stock rows inside the
  caller transaction to prevent overselling.
- Lot traceability retains product, supplier/receiving, movement, and sale
  relationships.
- Voiding a lot is auditable and does not erase historical movements.

`LotsModule` provides `FefoService` to sales and receiving flows and integrates
with inventory movements, configuration, and audit logging.
