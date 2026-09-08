-- PMS-010 — Sales returns and cancellations.
--
-- 1. Add CANCELLATION value to pharmacy.MovementType so an inventory
--    reversal of a fully cancelled sale is distinguishable from a customer
--    return.
-- 2. Enforce that return_items.lot_id always matches the lot_id recorded on
--    the original sale_items row (acceptance criterion of #30).
-- 3. Add a positive-quantity check on return_items.
-- 4. Index return_items by sale_item_id to speed up cumulative-return queries
--    that decide whether a given sale_item still has refundable quantity.

-- ─── 1. Extend MovementType ──────────────────────────────────────────────────
ALTER TYPE "pharmacy"."MovementType" ADD VALUE IF NOT EXISTS 'CANCELLATION';

-- ─── 2. Enforce return_items.lot_id = sale_items.lot_id ─────────────────────
-- A composite foreign key (sale_item_id, lot_id) referencing sale_items
-- (id, lot_id) guarantees that any inserted return_item references a row
-- whose lot_id is identical to the value supplied for return_items.lot_id.
-- sale_items is already UNIQUE on its primary key, so we add a UNIQUE index
-- on (id, lot_id) to make the composite FK satisfiable.
CREATE UNIQUE INDEX IF NOT EXISTS "sale_items_id_lot_id_key"
  ON "pharmacy"."sale_items" ("id", "lot_id");

ALTER TABLE "pharmacy"."return_items"
  ADD CONSTRAINT "return_items_sale_item_id_lot_id_fkey"
  FOREIGN KEY ("sale_item_id", "lot_id")
  REFERENCES "pharmacy"."sale_items" ("id", "lot_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 3. Positive return quantity ─────────────────────────────────────────────
ALTER TABLE "pharmacy"."return_items"
  ADD CONSTRAINT "return_items_quantity_positive_check"
  CHECK ("quantity" > 0);

-- ─── 4. Faster cumulative-return lookup ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS "return_items_sale_item_id_idx"
  ON "pharmacy"."return_items" ("sale_item_id");
