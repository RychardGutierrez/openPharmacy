-- PMS-012-DB: Lot-level unit cost, product min sale price, and price history.
--
-- 1. Adds lots.unit_cost — the cost actually paid for THIS specific lot.
--    Backfilled from products.cost_price for existing rows, then NOT NULL.
-- 2. Adds products.min_sale_price — a regulatory floor for the sale price.
--    Backfilled from the previous products.cost_price (defensive default).
-- 3. Drops products.cost_price — a single product cost is no longer
--    meaningful once cost lives on the lot.
-- 4. Creates pharmacy.product_price_history — audit trail for every
--    change to a product's sale price (who, when, old/new, reason).

-- ─── 1. Lot unit cost ────────────────────────────────────────────────────────
ALTER TABLE "pharmacy"."lots"
  ADD COLUMN "unit_cost" DECIMAL(12,2);

-- Backfill from the product's current cost price (best available reference).
UPDATE "pharmacy"."lots" l
SET "unit_cost" = p."cost_price"
FROM "pharmacy"."products" p
WHERE l."product_id" = p."id" AND l."unit_cost" IS NULL;

ALTER TABLE "pharmacy"."lots"
  ALTER COLUMN "unit_cost" SET NOT NULL;

-- ─── 2. Product min sale price ───────────────────────────────────────────────
ALTER TABLE "pharmacy"."products"
  ADD COLUMN "min_sale_price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill the floor from the previous cost price so we don't silently allow
-- selling below the old cost.
UPDATE "pharmacy"."products"
SET "min_sale_price" = "cost_price"
WHERE "min_sale_price" = 0 AND "cost_price" > 0;

-- ─── 3. Drop the obsolete product cost price ─────────────────────────────────
ALTER TABLE "pharmacy"."products"
  DROP COLUMN "cost_price";

-- ─── 4. Product price history (audit trail) ─────────────────────────────────
CREATE TABLE "pharmacy"."product_price_history" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "old_sale_price" DECIMAL(12,2),
  "new_sale_price" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "changed_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_price_history_product_id_created_at_idx"
  ON "pharmacy"."product_price_history"("product_id", "created_at");

ALTER TABLE "pharmacy"."product_price_history"
  ADD CONSTRAINT "product_price_history_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "pharmacy"."products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pharmacy"."product_price_history"
  ADD CONSTRAINT "product_price_history_changed_by_fkey"
    FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
