# Products Module

Product catalog management for pharmaceutical and non-pharmaceutical items.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/products` | Create a product |
| `GET` | `/api/products` | Paginated catalog with filters |
| `GET` | `/api/products/search` | Search products for selectors and POS |
| `POST` | `/api/products/bulk-import` | Import products from CSV |
| `GET` | `/api/products/:id` | Read product details |
| `PATCH` | `/api/products/:id` | Update product fields |
| `PATCH` | `/api/products/:id/price` | Change sale pricing |
| `GET` | `/api/products/:id/price-history` | Read price history |
| `PATCH` | `/api/products/:id/deactivate` | Soft-deactivate a product |
| `PATCH` | `/api/products/:id/activate` | Reactivate a product |

## Domain notes

- Product identity includes generic/commercial names, barcode, category, and
  optional pharmaceutical metadata.
- Barcodes are unique and validated before writes and imports.
- Prices, minimum stock, and category rules are validated at the API boundary.
- Controlled categories (`PSYCHOTROPIC` and `NARCOTIC`) participate in SEDES
  compliance and sales restrictions.
- Deactivation preserves historical sales and inventory references.
- Price changes are recorded in product price history and audit logs.

## Structure and dependencies

The controller exposes the HTTP contract, `ProductsService` owns catalog rules,
and `ProductsRepository` handles persistence. The module also uses audit,
configuration, and product-rules services. CSV import is handled by the bulk
import service and returns row-level validation errors.
