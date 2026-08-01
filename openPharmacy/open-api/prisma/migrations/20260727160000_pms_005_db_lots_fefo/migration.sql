-- PMS-005-DB: Lot management, expiry control, and FEFO stock deduction.
--
-- 1. Fixes the Lot -> Product relation: the previous schema declared
--    Lot.product as Product[], which materialised a spurious implicit
--    many-to-many table (_LotToProduct) and left lots.product_id without
--    a foreign key. We drop that join table and add the real FK.
-- 2. Adds regulatory soft-void columns (voided_at, voided_by, void_reason)
--    so mistaken lots can be annulled without erasing history.
-- 3. Adds a B-tree index on lots.expiry_date (required for expiry alert
--    queries; verified with EXPLAIN ANALYZE before merging).
-- 4. Adds unique constraint (product_id, lot_number).
-- 5. Creates pharmacy.fn_deduct_stock_fefo: fully transactional PostgreSQL
--    function that deducts stock using First-Expired-First-Out, skips
--    expired and voided lots, and raises an exception (causing rollback)
--    if the requested quantity cannot be fulfilled.

-- ─── 1. Remove the spurious implicit many-to-many table ────────────────────
DROP TABLE IF EXISTS "pharmacy"."_LotToProduct" CASCADE;

-- ─── 2. Add soft-void columns (regulatory: never hard-delete lot history) ──
ALTER TABLE "pharmacy"."lots"
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "voided_by" UUID,
  ADD COLUMN "void_reason" TEXT;

-- ─── 3. Add the real foreign key from lots to products ─────────────────────
ALTER TABLE "pharmacy"."lots"
  ADD CONSTRAINT "lots_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "pharmacy"."products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 4. Add indexes and unique constraint ──────────────────────────────────
CREATE INDEX "lots_product_id_idx" ON "pharmacy"."lots"("product_id");
CREATE INDEX "lots_expiry_date_idx" ON "pharmacy"."lots"("expiry_date");
CREATE UNIQUE INDEX "lots_product_id_lot_number_key" ON "pharmacy"."lots"("product_id", "lot_number");

-- ─── 5. Add foreign key for the user who voided the lot ────────────────────
ALTER TABLE "pharmacy"."lots"
  ADD CONSTRAINT "lots_voided_by_fkey"
    FOREIGN KEY ("voided_by") REFERENCES "auth"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 6. Create the transactional FEFO stock-deduction function ─────────────
CREATE OR REPLACE FUNCTION "pharmacy"."fn_deduct_stock_fefo"(
  p_product_id UUID,
  p_qty INT
) RETURNS TABLE (
  lot_id UUID,
  lot_number TEXT,
  deducted_qty INT
) AS $$
DECLARE
  v_remaining INT := p_qty;
  v_lot RECORD;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'fn_deduct_stock_fefo: quantity must be positive (got %)', p_qty;
  END IF;

  -- Select candidate lots in FEFO order and lock them to prevent concurrent
  -- sales from overselling the same stock. Expired and voided lots are ignored.
  FOR v_lot IN
    SELECT l.id, l.lot_number, l.current_qty
    FROM "pharmacy"."lots" l
    WHERE l.product_id = p_product_id
      AND l.current_qty > 0
      AND l.expiry_date >= CURRENT_DATE
      AND l.voided_at IS NULL
    ORDER BY l.expiry_date ASC, l.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_lot.current_qty >= v_remaining THEN
      UPDATE "pharmacy"."lots" l
      SET current_qty = l.current_qty - v_remaining
      WHERE l.id = v_lot.id;

      lot_id := v_lot.id;
      lot_number := v_lot.lot_number;
      deducted_qty := v_remaining;
      RETURN NEXT;

      v_remaining := 0;
      EXIT;
    ELSE
      UPDATE "pharmacy"."lots" l
      SET current_qty = 0
      WHERE l.id = v_lot.id;

      lot_id := v_lot.id;
      lot_number := v_lot.lot_number;
      deducted_qty := v_lot.current_qty;
      RETURN NEXT;

      v_remaining := v_remaining - v_lot.current_qty;
    END IF;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'fn_deduct_stock_fefo: insufficient active non-expired stock for product % (requested %, short by %)', p_product_id, p_qty, v_remaining;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;
