# Products Feature

Full CRUD frontend for the pharmaceutical product catalog. Built with the project's feature-sliced architecture and shared tooling (React Query, Zustand, React Hook Form + Zod v4, TanStack React Table / Virtual).

## Directory Structure

```
features/products/
├── api/
│   ├── constants.ts                 # User-facing error message map
│   ├── products-api.ts              # Low-level fetch wrappers
│   ├── use-activate-product.ts      # React Query mutation: reactivate
│   ├── use-bulk-import-products.ts  # React Query mutation: CSV import
│   ├── use-create-product.ts        # React Query mutation: create
│   ├── use-deactivate-product.ts    # React Query mutation: soft delete
│   ├── use-product.ts               # React Query: single product
│   ├── use-products.ts              # React Query: paginated list
│   ├── use-search-products.ts       # React Query: autocomplete/search
│   └── use-update-product.ts        # React Query mutation: update
├── components/
│   ├── barcode-uniqueness-indicator.tsx  # Debounced barcode conflict hint
│   ├── category-card-group.tsx           # Accessible category radiogroup
│   ├── compliance-warning-banner.tsx     # SEDES warning for controlled categories
│   ├── product-bulk-import-dialog.tsx    # CSV upload + per-row error report
│   ├── product-category-badge.tsx        # Colored category pill
│   ├── product-deactivate-dialog.tsx     # Soft-delete confirmation
│   ├── product-form.tsx                  # RHF + Zod create/edit form
│   ├── products-filters.tsx              # Search, category, status filters
│   ├── products-page-client.tsx          # Main catalog page
│   ├── products-pagination.tsx           # Prev/next pagination
│   └── products-table.tsx                # Virtualized product table
├── hooks/                           # Reserved for future product hooks
├── store/                           # Reserved for future product store
└── types.ts                         # Zod schemas, enums, labels, helpers
```

## Product Model

A product represents a pharmaceutical or non-pharmaceutical item in inventory.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `dciName` | string | Denominación Común Internacional (generic name) |
| `commercialName` | string | Brand/commercial name |
| `laboratory` | string? | Manufacturer |
| `form` | string? | e.g. Tableta, Jarabe |
| `concentration` | string? | e.g. 500mg |
| `barcode` | string | 3–14 digits, unique |
| `category` | `ProductCategory` | See below |
| `salePrice` | number | Selling price in BOB |
| `costPrice` | number | Cost price in BOB |
| `minStock` | number | Minimum stock threshold |
| `active` | boolean | Soft-delete flag |

### Categories

| Enum value | Spanish label | Controlled |
|---|---|---|
| `OTC` | Venta libre | No |
| `PRESCRIPTION_ONLY` | Con receta | No |
| `PSYCHOTROPIC` | Psicotrópico | Yes |
| `NARCOTIC` | Estupefaciente | Yes |
| `NON_PHARMACEUTICAL` | No farmacéutico | No |

Use `isControlledCategory(category)` from `types.ts` to determine whether a category triggers the SEDES compliance flow.

## Routes

| Route | Purpose | Role Gate |
|---|---|---|
| `/inventory/products` | Catalog list | ADMIN, PHARMACIST |
| `/inventory/products/new` | Create product | ADMIN, PHARMACIST |
| `/inventory/products/[productId]` | Product detail | ADMIN, PHARMACIST |
| `/inventory/products/[productId]/edit` | Edit product | ADMIN, PHARMACIST |
| `/inventory/products/[productId]/lots` | Lot history (stub) | ADMIN, PHARMACIST |

## API Hooks

### Queries

- `useProducts(query)` — paginated list with filters (`page`, `pageSize`, `category`, `active`, `q`).
- `useProduct(id)` — single product including soft-deleted ones.
- `useSearchProducts(q)` — autocomplete by name/barcode (used for the debounced barcode conflict check).

### Mutations

- `useCreateProduct()` — `POST /api/products`
- `useUpdateProduct()` — `PATCH /api/products/:id`
- `useActivateProduct()` — `PATCH /api/products/:id/activate`
- `useDeactivateProduct()` — `PATCH /api/products/:id/deactivate`
- `useBulkImportProducts()` — `POST /api/products/bulk-import` with `multipart/form-data`

All mutations invalidate the product list on success and show toast notifications.

## Key Components

### `ProductForm`

Reusable create/edit form. Features:

- React Hook Form + Zod v4 validation
- Controlled numeric inputs for prices and `minStock`
- Barcode input restricted to digits
- Category selector cards
- Inline SEDES compliance warning when `PSYCHOTROPIC` or `NARCOTIC` is selected
- Debounced barcode uniqueness indicator

### `ProductsTable`

Virtualized table using `@tanstack/react-virtual`. The body rows are rendered with CSS Grid and absolute positioning so virtualization works reliably regardless of `<tr>` layout quirks. A single `GRID_TEMPLATE` constant guarantees header and row columns align.

### `ProductBulkImportDialog`

CSV import dialog:

- File picker restricted to `.csv`
- Downloadable template with sample row
- Per-row error table when rows fail validation
- Success summary (`inserted` count)

## Form Validation

The `productFormSchema` enforces:

- `dciName` / `commercialName`: required, 1–255 chars
- `barcode`: 3–14 digits
- `category`: one of the five enum values
- `salePrice` / `costPrice`: non-negative numbers
- `minStock`: integer, 0–999999

## Error Codes

Defined in `api/constants.ts`:

| Code | Message |
|---|---|
| `DUPLICATE_BARCODE` | Este código de barras ya está registrado. |
| `PRODUCT_NOT_FOUND` | Producto no encontrado. |
| `CSV_EMPTY` | El archivo CSV está vacío o no se envió. |
| `CSV_INVALID` | El archivo CSV no tiene un formato válido. |
| `UNKNOWN` | Algo salió mal. Intenta nuevamente. |

## Backend Notes

The frontend relies on the NestJS `products` module in `../open-api`. The `active` query parameter is sensitive to boolean conversion: the DTO uses `@Type(() => String)` to prevent `enableImplicitConversion` from converting `"false"` to `true` before the explicit `@Transform` runs.

## Acceptance Criteria (PMS-004-FE)

- Catalog list supports search, category filter, status filter, and pagination.
- Virtual scrolling keeps 500+ rows smooth.
- Selecting `PSYCHOTROPIC` or `NARCOTIC` shows the SEDES compliance banner immediately.
- Barcode field shows a debounced "already exists" hint before submission.
- Bulk CSV import with downloadable template.
- Deactivate action performs a soft delete; product remains visible in history.

## Related Backend Tickets

- `PMS-004-BE` — Product CRUD API
- `PMS-004-DB` — Product schema / migrations
