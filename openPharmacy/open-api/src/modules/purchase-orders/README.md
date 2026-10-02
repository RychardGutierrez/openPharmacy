# Purchase Orders Module

Supplier purchasing lifecycle from draft through receiving.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/purchase-orders` | Create a purchase order |
| `GET` | `/api/purchase-orders` | List purchase orders |
| `GET` | `/api/purchase-orders/last-cost` | Read recent product cost |
| `GET` | `/api/purchase-orders/:id` | Read order details |
| `PATCH` | `/api/purchase-orders/:id` | Edit a draft order |
| `PATCH` | `/api/purchase-orders/:id/submit` | Submit an order |
| `PATCH` | `/api/purchase-orders/:id/receive` | Receive stock and costs |

## Domain rules

- Supplier and product references are validated before writes.
- Draft orders are editable; submitted orders follow the receiving workflow.
- Receiving creates lot and inventory movement records and preserves the
  received cost for later purchasing analysis.
- Status transitions and receiving actions are audited.

The module integrates with suppliers, lots, inventory movements, and audit
repositories. Receiving must remain transactional across the order, lots, and
stock movements.
