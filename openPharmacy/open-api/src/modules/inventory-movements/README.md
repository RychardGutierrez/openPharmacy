# Inventory Movements Module

Immutable inventory history and approval-based manual stock adjustments.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/inventory-movements/adjustments` | Request a stock adjustment |
| `GET` | `/api/inventory-movements/adjustments` | List adjustment requests |
| `GET` | `/api/inventory-movements/adjustments/:id` | Read an adjustment |
| `POST` | `/api/inventory-movements/adjustments/:id/approve` | Approve and apply an adjustment |
| `POST` | `/api/inventory-movements/adjustments/:id/reject` | Reject an adjustment |
| `GET` | `/api/inventory-movements` | List stock movements |
| `GET` | `/api/inventory-movements/:id` | Read a movement |

## Domain rules

- Adjustment requests move through `PENDING`, `APPROVED`, or `REJECTED`.
- Approval and rejection are separate operations and are role protected.
- Applied adjustments create auditable movement records rather than mutating
  history.
- Sales, returns, receiving, and lot operations use this module to record stock
  effects consistently.

The repository owns movement queries and the service coordinates validation,
approval, stock changes, and audit records.
