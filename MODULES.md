# Module Catalog

This document is the index for the backend and frontend modules in
openPharmacy. Backend routes are prefixed with `/api` when called through the
HTTP application. Every backend route is protected by the global JWT guard
unless explicitly marked public.

## Backend Modules

| Module | Responsibility | Main route(s) | Frontend feature |
|---|---|---|---|
| `auth` | Login, refresh rotation, logout, JWT guards, lockout | `/auth` | `auth` |
| `users` | User CRUD, roles, activation, profile, password | `/users` | `users` |
| `products` | Product catalog, status, barcode search/import | `/products` | `products` |
| `lots` | Inventory lots, expiry, FEFO stock operations | `/lots` | `lots` |
| `inventory-movements` | Stock history and approval-based adjustments | `/inventory-movements` | `inventory-movements` |
| `shifts` | Open/close cash shifts and reopen approvals | `/shifts` | `shifts` |
| `sales` | POS sale registration, receipts, cancellation | `/sales` | `pos` |
| `returns` | Sale lookup and customer returns | `/returns` | `returns` |
| `prescriptions` | Prescription records associated with sales | `/prescriptions` | `prescriptions` |
| `suppliers` | Supplier CRUD, search, activation | `/suppliers` | `suppliers` |
| `purchase-orders` | Order creation, submission, receiving, costs | `/purchase-orders` | `purchase-orders` |
| `dashboard` | KPIs, trends, stock and expiry summaries, SSE | `/dashboard` | `dashboard` |
| `reports` | Report preview, generation, listing, downloads | `/reports` | `reports` |
| `config` | Pharmacy configuration and logo storage | `/config` | `configuration`, `config` |
| `sedes` | Pharmacy branches and regulatory locations | `/sedes` | `sedes` |
| `alerts` | Low-stock and operational alert retrieval | `/alerts` | `alerts` |
| `billing` | Billing document domain endpoints | `/billing` | shared with sales/configuration |
| `doctors` | Doctor directory and prescription providers | `/doctors` | `doctors` |

### Auth

`POST /auth/login`, `POST /auth/refresh`, and `POST /auth/logout` implement the
session lifecycle. JWT and role guards are registered globally. Refresh tokens
are rotated and stored server-side as hashed JTIs. See the detailed
[auth README](openPharmacy/open-api/src/modules/auth/README.md).

### Users

Administrators manage users through `/users`. The self-service endpoints are
`GET /users/me`, `PATCH /users/me`, and `PATCH /users/me/password`. Profile
editing is intentionally limited to the full name; CI, role, and professional
registration data remain controlled account fields. Password changes verify the
current password, update `password_changed_at`, revoke refresh sessions, and
write an audit event.

### Products and Lots

`products` owns catalog identity, pricing, categories, barcode uniqueness,
activation, and CSV import. `lots` owns batch quantities, expiry, voiding, and
FEFO selection. Sales and receiving depend on these modules rather than writing
inventory rules directly.

### Inventory Movements

This module records stock movements and provides an approval workflow for
inventory adjustments. Requests can be pending, approved, or rejected, with
role-aware approval and audit records.

### Shifts and Sales

`shifts` owns the cash-register lifecycle and reopen requests. `sales` requires
an active shift, deducts stock through FEFO, creates receipts and sale items,
and uses transactional writes. Read the detailed [sales documentation](openPharmacy/open-api/src/modules/sales/README.md)
and [frontend shifts documentation](openPharmacy/open-fronted/features/shifts/README.md).

### Returns and Prescriptions

`returns` handles sale eligibility and return completion while coordinating
inventory restoration. `prescriptions` stores prescription information used by
regulated-product workflows. Controlled products also produce compliance and
audit signals in the sales flow.

### Suppliers and Purchase Orders

`suppliers` provides the supplier directory and status operations.
`purchase-orders` manages the order lifecycle from draft through submission and
receiving, including last-cost information and inventory updates.

### Dashboard, Reports, and Alerts

`dashboard` provides operational KPIs, low-stock/expiry lists, recent sales,
trends, and server-sent sale notifications. `reports` supports preview and
queued or synchronous file generation, including signed download links.
`alerts` exposes operational notices for the dashboard and relevant workflows.

### Configuration, SEDES, Billing, and Doctors

`config` stores pharmacy settings and logo assets. `sedes` manages pharmacy
branches and regulatory location data. `billing` owns billing-domain records
that complement completed sales. `doctors` provides the directory used by
prescription workflows.

## Frontend Features

Frontend features follow the same business boundaries but can combine related
backend modules when the user workflow is shared.

| Feature | UI responsibility | Typical routes |
|---|---|---|
| `auth` | Login, session restoration, logout, route protection | `/login` |
| `users` | Admin user management and current profile/password | `/users`, `/profile` |
| `products` | Catalog CRUD, filters, import, controlled-category warnings | `/inventory/products/*` |
| `lots` | Lot listing, expiry and product lot history | `/inventory/lots*` |
| `inventory-movements` | Movement history and adjustment approvals | `/inventory/movements` |
| `shifts` | Cash register, close preview, reopen requests | `/sales/cash-register`, `/admin/reopen-requests` |
| `pos` | Search cart, payment, sale completion, receipt printing | `/sales/pos` |
| `returns` | Return lookup, eligibility, and completion | `/sales/returns` |
| `prescriptions` | Prescription types and UI contracts for regulated sales | shared workflow |
| `suppliers` | Supplier list, filters, detail and forms | `/purchasing/suppliers` |
| `purchase-orders` | Order list, creation, editing, detail, receiving | `/purchasing/orders*` |
| `dashboard` | KPI cards, charts, live sale updates, stock summaries | `/dashboard` |
| `reports` | Report filters, preview, generation and downloads | `/reports` |
| `configuration` | Admin settings, logo upload, pharmacy values | `/settings` |
| `config` | Shared configuration contracts/helpers | shared |
| `sedes` | Branch listing and management UI | `/sedes` |
| `alerts` | Alert contracts and dashboard presentation | shared/dashboard |
| `doctors` | Doctor directory UI | `/doctors` |

## Cross-Cutting Rules

- `core/guards/auth-guard.ts` protects dashboard routes.
- `core/components/app-sidebar.tsx` and `core/config/navigation.ts` define the
  main navigation and role visibility.
- `features/*/api` owns fetch wrappers and React Query invalidation.
- `features/*/types.ts` owns runtime response schemas and form validation.
- `shared/components` contains reusable status and role presentation.
- Backend `common/audit`, `common/config`, `common/mailer`, and global guards
  are shared by all business modules.

## Module Documentation Convention

When adding or changing a module, document:

1. Its domain responsibility and invariants.
2. Routes, authentication requirements, and role restrictions.
3. Important request/response shapes and error codes.
4. Database tables, transactions, events, and external dependencies.
5. Frontend routes, hooks, cache invalidation, and known limitations.

Detailed READMEs should live beside the module code; this catalog should remain
the high-level entry point.
