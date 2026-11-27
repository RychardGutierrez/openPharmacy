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
| `GET` | `/api/products/sin/summary` | Count active products with and without SIN codes (SIAT-08) |
| `POST` | `/api/products/sin/bulk-assign` | Assign one set of SIN codes to selected products or a category |
| `GET` | `/api/products/sin/defaults` | Default SIN codes per category |
| `PUT` | `/api/products/sin/defaults/:category` | Set a category's default SIN codes |
| `POST` | `/api/products/sin/defaults/:category/apply` | Copy a category default onto its products without codes |

`GET /api/products` also accepts `sinPending=true`: active products with no complete SIN codes
and no category default. All SIN routes are ADMIN and PHARMACIST.

## SIN homologation (SIAT-08)

Each product carries the three codes an invoice line needs: `sinActivityCode` (CAEB activity),
`sinProductCode` (SIN product code) and `sinUnitCode` (unit of measure). The rules live in
`ProductSinService` (`product-sin.service.ts`).

- **All three or none.** A partial set is rejected with 422 `INCOMPLETE_SIN_CODES` (`missing`).
  On `PATCH` the codes not sent are merged with the stored ones before this check.
- **Checked against the synced SIN catalogs** (`siat_catalog_items`, SIAT-07). The activity must
  be active in `activities` (the activities registered on the NIT), the product must exist as
  `activity:product` in `products` (so it belongs to that activity), and the unit must be active
  in `units`. A failure is 422 `INVALID_SIN_CODES` with `failures[{field, code}]`. Until the
  activities catalog has been synced, only the digits-only format is checked.
- **Units.** Use the unit actually sold (blister vs box), because quantity × unit price must match
  the line subtotal.
- **Category defaults** (`pharmacy.product_sin_defaults`, one row per `ProductCategory`). A
  product's own codes always win. A default counts as homologated for the sale guard and for the
  pending count. `apply` writes the default onto products that have no complete codes.
- **Bulk assignment** takes `productIds` (max 500) or a `category`. Products that already have
  complete codes are skipped unless `overwrite` is true. Inactive and deleted products are skipped.
- **CSV import** accepts `sinActivityCode`, `sinProductCode`, `sinUnitCode` (or the snake_case
  headers). Empty cells mean "not homologated". Invalid codes are reported per row. See
  `documents/products-sample-import.csv`.
- **Audit.** `PRODUCT_SIN_CODES_UPDATED` (product, before and after codes, acting user),
  `PRODUCT_SIN_CODES_BULK_ASSIGNED` (scope, count, codes) and `PRODUCT_SIN_DEFAULT_UPDATED`.
- **Sale guard.** With `SIAT_ENABLED=true`, `SalesService` calls `ProductSinService.assertSalable`
  inside the sale transaction. A product with no complete codes of its own and no category default
  is rejected with 409 `PRODUCT_NOT_HOMOLOGATED` (`products[{id, commercialName}]`). With SIAT
  disabled nothing is blocked, so codes can be filled in gradually before the Fase III pilot.
- **For invoices (SIAT-11).** The effective codes of a line are the product's own codes
  (`ProductSinService.ownCodes`), otherwise its category default. There is no single resolver
  yet; SIAT-11 should add one to `ProductSinService` so the guard and the invoice use one rule.

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

`ProductSinService` (SIAT-08) owns SIN homologation. It reads `SiatCatalogsService`, so
`ProductsModule` imports `SiatModule`, and it is exported for `SalesModule` (sale guard).
