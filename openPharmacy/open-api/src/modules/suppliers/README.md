# Suppliers Module

Supplier directory and lifecycle management used by purchasing workflows.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/suppliers` | Create a supplier |
| `GET` | `/api/suppliers` | List suppliers with filters and pagination |
| `GET` | `/api/suppliers/search` | Search suppliers for order forms |
| `GET` | `/api/suppliers/:id` | Read supplier details |
| `PATCH` | `/api/suppliers/:id` | Update supplier data |
| `PATCH` | `/api/suppliers/:id/deactivate` | Soft-deactivate a supplier |
| `PATCH` | `/api/suppliers/:id/activate` | Reactivate a supplier |

## Domain notes

- Supplier writes use DTO validation and repository persistence.
- Deactivation preserves purchase-order history and prevents new operational
  use without deleting the record.
- Search is optimized for purchase-order selectors.
- Create, update, activation, and deactivation operations are audited.

The module depends on the shared `AuditModule` and is consumed by
`PurchaseOrdersModule`.
