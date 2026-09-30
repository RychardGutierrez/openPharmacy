-- Dashboard date-range aggregates filter completed sales by status and time.
CREATE INDEX "sales_status_created_at_dashboard_idx"
  ON "pharmacy"."sales" ("status", "created_at")
  INCLUDE ("total");

-- Dashboard expiry queries only need active, non-empty lots ordered by expiry.
CREATE INDEX "lots_active_expiry_dashboard_idx"
  ON "pharmacy"."lots" ("expiry_date")
  INCLUDE ("product_id", "current_qty", "lot_number")
  WHERE "voided_at" IS NULL AND "current_qty" > 0;

-- Stock aggregation joins active lots by product.
CREATE INDEX "lots_active_product_stock_dashboard_idx"
  ON "pharmacy"."lots" ("product_id")
  INCLUDE ("current_qty")
  WHERE "voided_at" IS NULL;
