# `features/lots` — Lot Management & Expiry Control

This module implements the frontend for PMS-005-FE: registering, editing, voiding,
and tracing medication lots per product, with FEFO-aware expiry badges.

## Directory structure

```
features/lots/
  api/
    constants.ts             # User-facing error messages
    lots-api.ts              # Low-level fetch wrappers + LotsApiError
    use-lots.ts              # lotsKeys factory + useLots query
    use-lot.ts               # Single lot detail query
    use-lots-by-product.ts   # Lots scoped to a product
    use-expiry-dashboard.ts  # RED/ORANGE/GREEN dashboard
    use-lot-traceability.ts  # AGEMED traceability lookup
    use-create-lot.ts      # Create mutation
    use-update-lot.ts      # Edit (typo only) mutation
    use-void-lot.ts        # Void mutation
  components/
    lots-page-client.tsx          # Global lots list
    expiry-dashboard-page-client.tsx # RED/ORANGE/GREEN dashboard
    product-lots-page-client.tsx  # Per-product lots view
    lots-table.tsx                # Virtualized lot table
    lots-filters.tsx              # Search + status filter
    lots-pagination.tsx           # Pagination controls
    lot-form.tsx                  # RHF + Zod create/edit form
    lot-form-dialog.tsx           # Dialog wrapper for the form
    lot-void-dialog.tsx           # AlertDialog for voiding
    lot-trace-dialog.tsx          # Dialog for traceability lookup
    lot-actions-menu.tsx          # Shared dropdown menu
    lot-status-badge.tsx          # RED/ORANGE/GREEN expiry badge
    lot-fefo-indicator.tsx        # FEFO "next dispense" arrow
    expiry-banner.tsx             # Inline alert on product page
  types.ts              # Zod schemas, expiry helpers, labels
  README.md             # This file
```

## Model

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `productId` | `string` | Parent product UUID |
| `lotNumber` | `string` | Manufacturer batch number |
| `expiryDate` | `string` | ISO date (YYYY-MM-DD) |
| `initialQty` | `number` | Received quantity |
| `currentQty` | `number` | Remaining quantity |
| `voidedAt` | `string \| null` | When the lot was voided |
| `voidReason` | `string \| null` | Why it was voided |

## Routes

| Route | Page client | Role gate |
|---|---|---|
| `/inventory/lots` | `LotsPageClient` | ADMIN, PHARMACIST |
| `/inventory/lotsExpiry` | `ExpiryDashboardPageClient` | ADMIN, PHARMACIST |
| `/inventory/products/[productId]/lots` | `ProductLotsPageClient` | ADMIN, PHARMACIST |

## Expiry thresholds

Single source of truth is `classifyExpiry(daysUntil)` in `types.ts`:

- **RED** — `daysUntil <= 30` (expired or about to expire)
- **ORANGE** — `31 <= daysUntil <= 60` (expiring soon)
- **GREEN** — `daysUntil > 60` (vigente)

These values mirror the backend `LotsService.classifyExpiry`.

## API hooks

- `useLots(query)` — paginated global list.
- `useLot(id)` — single lot detail (`GET /api/lots/:id`).
- `useLotsByProduct(productId)` — per-product list.
- `useExpiryDashboard()` — dashboard grouped by status.
- `useLotTraceability(lotNumber)` — traceability lookup.
- `useCreateLot`, `useUpdateLot`, `useVoidLot` — mutations.

## Error codes

See `api/constants.ts`. The most common backend codes are:

- `LOT_NOT_FOUND`
- `DUPLICATE_LOT`
- `LOT_HAS_STOCK`
- `LOT_HAS_DEPENDENCIES`
- `LOT_ALREADY_VOIDED`

## Key components

- `LotsTable` — virtualized CSS-grid table, default-sorted by expiry date ascending.
  First non-expired, non-voided, positive-stock lot shows the FEFO arrow.
- `LotForm` — supports create and edit modes. In edit mode, `initialQty` is read-only
  and a `reason` is required.
- `LotActionsMenu` — shared action menu used in the table row and the per-product page
  header. Disabled when no lot is selected.
- `ExpiryBanner` — inline alert shown on the product page when any lot is RED or ORANGE.

## Related tickets

- Frontend: `PMS-005-FE` (GitHub issue #13)
- Backend: `PMS-005-BE` (GitHub issue #14)
- Database: `PMS-005-DB` (GitHub issue #15)
