# openPharmacy — Database & Prisma ORM

Documentation for the database layer of the openPharmacy API, built with **Prisma 7** and **PostgreSQL 16**.

---

## 1. Architecture Overview

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│  NestJS API  │───▶│ PrismaModule │───▶│  PostgreSQL 16  │
│  (modules)    │    │ PrismaService│    │  (Docker)       │
└─────────────┘    └──────────────┘    └────────────────┘
                          │
                   ┌──────┴──────┐
                   │  @prisma/   │
                   │  adapter-pg │
                   └─────────────┘
```

- **PrismaModule** is global — inject `PrismaService` in any module.
- **PrismaService** extends `PrismaClient` with NestJS lifecycle hooks (`OnModuleInit` / `OnModuleDestroy`).
- Uses `@prisma/adapter-pg` driver adapter (Prisma 7 pattern).
- Generator uses `prisma-client-js` (legacy CJS) to avoid ESM/`import.meta` conflicts with the NestJS CJS build process.

---

## 2. File Structure

```
open-api/
├── prisma/
│   ├── schema.prisma           # Schema definition (18 models, 9 enums, 2 schemas)
│   ├── seed.ts                 # Database seeder (users + products)
│   └── migrations/             # SQL migration history
│       ├── 20260710033706_init/
│       │   └── migration.sql
│       ├── 20260710034557_multi_schema/
│       │   └── migration.sql
│       ├── 20260712190000_pms_002_be_auth/
│       │   └── migration.sql    # PMS-002-BE: lockout columns, RefreshToken, AuditLog
│       └── 20260712200000_drop_technician_role/
│           └── migration.sql    # PMS-002-BE: drop TECHNICIAN from UserRole
├── prisma.config.ts            # Prisma CLI config (loads .env, seed path)
├── test/__mocks__/
│   └── prisma-client-mock.ts  # Stub for unit tests (avoids loading real Prisma client)
├── src/
│   └── prisma/
│       ├── prisma.service.ts   # PrismaClient + NestJS lifecycle
│       └── prisma.module.ts    # Global module exporting PrismaService
├── .env                        # DATABASE_URL (gitignored)
└── package.json                # prisma:* scripts
```

---

## 3. Prisma 7 Config Pattern

Prisma 7 changed how datasource URLs are configured:

- `schema.prisma` — **no `url`** in `datasource db` block, but defines `schemas = ["auth", "pharmacy"]`
- `prisma.config.ts` — CLI reads connection URL from here
- `PrismaService` — passes driver adapter to `PrismaClient` constructor
- Generator uses `prisma-client-js` (not the newer `prisma-client` provider) so the output is CJS-compatible with the NestJS build.

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

```ts
// src/prisma/prisma.service.ts
import { PrismaClient } from '@prisma/client';
// ...
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
super({ adapter });
```

---

## 4. Multi-Schema Layout

The database uses two PostgreSQL schemas for domain isolation:

### `auth` schema
| Model           | Table             | Enums                          |
| --------------- | ----------------- | ------------------------------ |
| `Role`          | `roles`           | `UserRole`                     |
| `User`          | `users`           |                                |
| `RefreshToken`  | `refresh_tokens`  |                                |
| `AuditLog`      | `audit_logs`      |                                |
| `Shift`         | `shifts`          | `ShiftStatus`                  |

### `pharmacy` schema
| Model                | Table                  | Enums                                          |
| -------------------- | ---------------------- | ---------------------------------------------- |
| `Product`            | `products`             | `ProductCategory`                              |
| `Lot`                | `lots`                 |                                                |
| `InventoryMovement`  | `inventory_movements`  | `MovementType`                                 |
| `Supplier`           | `suppliers`            |                                                |
| `PurchaseOrder`      | `purchase_orders`      | `PurchaseOrderStatus`                          |
| `OrderItem`          | `order_items`          |                                                |
| `Sale`               | `sales`                | `PaymentMethod`, `SaleStatus`                  |
| `SaleItem`           | `sale_items`           |                                                |
| `Return`             | `returns`              | `ReturnType`                                   |
| `ReturnItem`         | `return_items`         |                                                |
| `Doctor`             | `doctors`              |                                                |
| `Prescription`       | `prescriptions`        | `ControlledType`                               |
| `Config`             | `config`               |                                                |

### Cross-schema foreign keys
PostgreSQL supports FKs across schemas. Examples:
- `pharmacy.sales.user_id` → `auth.users.id`
- `pharmacy.inventory_movements.user_id` → `auth.users.id`
- `pharmacy.config.updated_by` → `auth.users.id`

No code changes needed — Prisma handles cross-schema queries transparently.

---

## 5. Database Schema

### Enums (9)

| Enum                  | Schema    | Values                                                       |
| --------------------- | --------- | ------------------------------------------------------------ |
| `UserRole`            | auth      | ADMIN, PHARMACIST, CASHIER                                   |
| `ShiftStatus`         | auth      | OPEN, CLOSED                                                 |
| `ProductCategory`     | pharmacy  | OTC, PRESCRIPTION, CONTROLLED, COSMETIC, SUPPLEMENT, OTHER   |
| `MovementType`        | pharmacy  | ENTRY, EXIT, ADJUSTMENT, TRANSFER, RETURN                    |
| `PurchaseOrderStatus` | pharmacy  | PENDING, ORDERED, PARTIAL, RECEIVED, CANCELLED               |
| `PaymentMethod`       | pharmacy  | CASH, CARD, TRANSFER, QR                                     |
| `SaleStatus`          | pharmacy  | COMPLETED, CANCELLED, REFUNDED                               |
| `ReturnType`          | pharmacy  | FULL, PARTIAL                                                |
| `ControlledType`      | pharmacy  | NONE, SCHEDULE_I, SCHEDULE_II, SCHEDULE_III, SCHEDULE_IV     |

### Models (18 tables)

#### Auth Schema — Users & Roles

| Model    | Table     | Schema | PK   | Key fields                                            |
| -------- | --------- | ------ | ---- | ----------------------------------------------------- |
| `Role`   | `roles`   | auth   | enum | name (UserRole PK), description                       |
| `User`   | `users`   | auth   | uuid | full_name, ci, email, password_hash, role_name (FK), reg_number, active, deleted_at, last_login, failed_attempts, locked_until, last_failed_at, password_changed_at |
| `RefreshToken` | `refresh_tokens` | auth | uuid | user_id (FK CASCADE), hashed_jti (UNIQUE), expires_at, revoked_at, replaced_by |
| `AuditLog` | `audit_logs` | auth | uuid | user_id (FK SET NULL), event, ip, user_agent, metadata (JSONB) |

#### Auth Schema — Shifts

| Model   | Table    | Schema | PK   | Key fields                                            |
| ------- | -------- | ------ | ---- | ----------------------------------------------------- |
| `Shift` | `shifts` | auth   | uuid | user_id (FK), opening_cash, closing_cash, expected_cash, status, opened_at, closed_at |

#### Pharmacy Schema — Products & Inventory

| Model                | Table                  | Schema   | PK   | Key fields                                            |
| -------------------- | ---------------------- | -------- | ---- | ----------------------------------------------------- |
| `Product`            | `products`             | pharmacy | uuid | dci_name, commercial_name, laboratory, form, concentration, barcode, category, sale_price, cost_price, min_stock, active, deleted_at |
| `Lot`                | `lots`                 | pharmacy | uuid | product_id (FK), lot_number, expiry_date, initial_qty, current_qty |
| `InventoryMovement`  | `inventory_movements`  | pharmacy | uuid | product_id (FK), lot_id (FK), user_id (FK), movement_type, quantity, reason, approved_by (FK) |

#### Pharmacy Schema — Suppliers & Purchasing

| Model            | Table              | Schema   | PK   | Key fields                                            |
| ---------------- | ------------------ | -------- | ---- | ----------------------------------------------------- |
| `Supplier`       | `suppliers`        | pharmacy | uuid | name, nit, address, city, contact_person, phone, email, payment_terms, active |
| `PurchaseOrder`  | `purchase_orders`  | pharmacy | uuid | supplier_id (FK), user_id (FK), status, invoice_number, order_date |
| `OrderItem`      | `order_items`      | pharmacy | uuid | order_id (FK), product_id (FK), qty_ordered, qty_received, unit_cost, lot_number, expiry_date |

#### Pharmacy Schema — Sales

| Model      | Table        | Schema   | PK   | Key fields                                            |
| ---------- | ------------ | -------- | ---- | ----------------------------------------------------- |
| `Sale`     | `sales`      | pharmacy | uuid | shift_id (FK), user_id (FK), receipt_number, subtotal, discount, total, payment_method, cash_received, change_given, status |
| `SaleItem` | `sale_items` | pharmacy | uuid | sale_id (FK), product_id (FK), lot_id (FK), quantity, unit_price, line_total |

#### Pharmacy Schema — Returns

| Model         | Table           | Schema   | PK   | Key fields                                            |
| ------------- | --------------- | -------- | ---- | ----------------------------------------------------- |
| `Return`      | `returns`       | pharmacy | uuid | sale_id (FK), user_id (FK), reason, return_type       |
| `ReturnItem`  | `return_items`  | pharmacy | uuid | return_id (FK), sale_item_id (FK), lot_id (FK), quantity |

#### Pharmacy Schema — Prescriptions & Doctors

| Model           | Table           | Schema   | PK   | Key fields                                            |
| --------------- | --------------- | -------- | ---- | ----------------------------------------------------- |
| `Doctor`        | `doctors`       | pharmacy | uuid | full_name, reg_number, specialty, phone, email, active |
| `Prescription`  | `prescriptions` | pharmacy | uuid | sale_id (FK), doctor_id (FK), patient_name, patient_ci, rx_date, rx_number, image_path, controlled_type |

#### Pharmacy Schema — Config

| Model    | Table    | Schema   | PK   | Key fields                                            |
| -------- | -------- | -------- | ---- | ----------------------------------------------------- |
| `Config` | `config` | pharmacy | uuid | key (unique), value, encrypted, updated_at, updated_by (FK) |

---

## 6. Entity Relationships

```
User ──┬── has many Shifts
       ├── has many Sales (as cashier)
       ├── has many Returns (as authorizer)
       ├── has many InventoryMovements (as performer)
       ├── has many PurchaseOrders (as creator)
       ├── has many Config updates
       ├── has many RefreshTokens
       └── has many AuditLogs

Role ───── has many Users

Shift ──── has many Sales

Product ──┬── has many Lots
          ├── has many InventoryMovements
          ├── has many OrderItems
          └── has many SaleItems

Lot ──────┬── has many InventoryMovements
          ├── has many SaleItems
          └── has many ReturnItems

Supplier ──── has many PurchaseOrders

PurchaseOrder ──── has many OrderItems

Sale ────┬── has many SaleItems
         ├── has many Returns
         └── has many Prescriptions

SaleItem ──── has many ReturnItems

Return ──── has many ReturnItems

Doctor ──── has many Prescriptions
```

---

## 6. NPM Scripts

| Script                  | Command                                      | Description                              |
| ----------------------- | -------------------------------------------- | ---------------------------------------- |
| `npm run db:up`         | `docker compose up -d postgres`              | Start PostgreSQL container               |
| `npm run db:down`       | `docker compose down`                        | Stop container (data preserved)          |
| `npm run db:reset`      | `docker compose down -v && up -d`            | Destroy volume, start fresh              |
| `npm run db:seed`       | `npx tsx prisma/seed.ts`                    | Seed database with sample data           |
| `npm run prisma:generate` | `npx prisma generate`                      | Regenerate Prisma Client                 |
| `npm run prisma:migrate`  | `npx prisma migrate dev`                   | Create & apply migration                 |
| `npm run prisma:studio`   | `npx prisma studio`                        | Open Prisma Studio (DB GUI)              |
| `npm run prisma:push`     | `npx prisma db push`                       | Push schema without migration (dev only) |

---

## 7. Common Workflows

### Create a new migration

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate migration SQL
npm run prisma:migrate -- --name describe_your_change
# 3. Prisma Client auto-regenerated
```

### Push schema without migration (quick dev)

```bash
npm run prisma:push
```

### Inspect database

```bash
npm run prisma:studio
# Opens http://localhost:5555
```

### Reset database

```bash
npm run db:reset
npm run prisma:migrate -- --name init
```

### Regenerate client after pulling changes

```bash
npm run prisma:generate
```

### Seed database

```bash
npm run db:seed
```

---

## 8. Database Seeding

The seed script (`prisma/seed.ts`) populates the database with sample data for development.

### What gets seeded

| Type    | Count | Details                                           |
| ------- | ----- | ------------------------------------------------- |
| Roles   | 3     | ADMIN, PHARMACIST, CASHIER                         |
| Users   | 3     | Admin, Pharmacist, Cashier (all: `password123`)   |
| Products | 10   | Realistic Bolivian pharmacy products              |

### Seeded Users

| Role        | Email                          | Password     |
| ----------- | ------------------------------ | ------------ |
| ADMIN       | admin@openpharmacy.com         | password123  |
| PHARMACIST  | pharmacist@openpharmacy.com    | password123  |
| CASHIER     | cashier@openpharmacy.com       | password123  |

### Seeded Products

| DCI Name        | Commercial | Lab              | Category      | Price (Bs) |
| --------------- | ---------- | ---------------- | ------------- | ---------- |
| Paracetamol     | Paragesic  | Phoenix          | OTC           | 12.50      |
| Ibuprofeno      | Ibuprom    | Medix            | OTC           | 18.00      |
| Amoxicilina     | Amoxil     | GSK              | PRESCRIPTION  | 35.00      |
| Omeprazol       | Omepral    | Mi Pharma        | OTC           | 22.00      |
| Losartan        | Losartan   | Microsules       | PRESCRIPTION  | 28.00      |
| Metformina      | Metformin  | Biopinox         | PRESCRIPTION  | 25.00      |
| Ambroxol        | Mucosolvan | Abbott           | OTC           | 32.00      |
| Diclofenaco     | Diclofen   | Ketonal          | OTC           | 15.00      |
| Ciprofloxacino  | Ciproxina  | Bayer            | PRESCRIPTION  | 42.00      |
| Loratadina      | Clarityne  | Bayer            | OTC           | 20.00      |

### Re-seeding

```bash
# Full reset (destroys all data)
npm run db:reset
npm run prisma:migrate --name init
npm run db:seed

# Or just re-run seed (idempotent - uses upsert)
npm run db:seed
```

---

## 9. Using PrismaService in a Module

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      where: { active: true, deleted_at: null },
      include: { lots: true },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { lots: true, inventoryMovements: true },
    });
  }
}
```

Entity files re-export Prisma types:

```ts
export type { Product } from '@prisma/client';
```

---

## 10. Modules Without Dedicated Tables

| Module       | Reason                                          |
| ------------ | ----------------------------------------------- |
| `dashboard`  | Read-only aggregation queries                   |
| `reports`    | Read-only aggregation queries                   |
| `billing`    | Wraps sales + prescriptions data                |
| `alerts`     | Computed from product.min_stock and lot.expiry_date |
| `auth`       | PMS-002-BE: adds RefreshToken + AuditLog tables  |
| `sedes`      | Not in current ERD (single pharmacy)            |

---

## 11. Soft Delete Pattern

Only `users` and `products` have `deleted_at`. Use Prisma middleware or service-level filtering:

```ts
// Always filter out soft-deleted records
const activeUsers = await this.prisma.user.findMany({
  where: { deleted_at: null },
});

// Soft delete
await this.prisma.user.update({
  where: { id },
  data: { deleted_at: new Date() },
});
```

---

## 12. Production Notes

- Never use `db push` in production — always use `migrate deploy`.
- Set `DATABASE_URL` via secret manager, not `.env` files.
- Run `npx prisma migrate deploy` in CI/CD pipeline.
- Monitor connection pool size via `@prisma/adapter-pg` config.
