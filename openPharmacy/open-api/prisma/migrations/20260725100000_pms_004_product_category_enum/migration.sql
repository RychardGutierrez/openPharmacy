-- PMS-004: update ProductCategory enum and add product indexes.
--
-- 1. Replaces the old ProductCategory enum (OTC, PRESCRIPTION, CONTROLLED,
--    COSMETIC, SUPPLEMENT, OTHER) with the new ticket values
--    (OTC, PRESCRIPTION_ONLY, PSYCHOTROPIC, NARCOTIC, NON_PHARMACEUTICAL).
-- 2. Maps existing product rows to the new enum values.
-- 3. Removes ControlledType, which is subsumed by the category enum.
-- 4. Adds indexes for soft-delete filtering, category filtering, and search.

-- ─── 1. Rebuild ProductCategory enum ───────────────────────────────────────
BEGIN;

ALTER TABLE "pharmacy"."products" ALTER COLUMN "category" DROP DEFAULT;

-- Cast to text so we can update values that are no longer valid enum members.
ALTER TABLE "pharmacy"."products" ALTER COLUMN "category" TYPE TEXT USING ("category"::text);

UPDATE "pharmacy"."products"
SET "category" = CASE "category"
  WHEN 'OTC' THEN 'OTC'
  WHEN 'PRESCRIPTION' THEN 'PRESCRIPTION_ONLY'
  WHEN 'CONTROLLED' THEN 'PSYCHOTROPIC'
  WHEN 'COSMETIC' THEN 'NON_PHARMACEUTICAL'
  WHEN 'SUPPLEMENT' THEN 'NON_PHARMACEUTICAL'
  WHEN 'OTHER' THEN 'NON_PHARMACEUTICAL'
  ELSE 'NON_PHARMACEUTICAL'
END;

CREATE TYPE "pharmacy"."ProductCategory_new" AS ENUM ('OTC', 'PRESCRIPTION_ONLY', 'PSYCHOTROPIC', 'NARCOTIC', 'NON_PHARMACEUTICAL');

ALTER TABLE "pharmacy"."products"
  ALTER COLUMN "category" TYPE "pharmacy"."ProductCategory_new"
  USING ("category"::"pharmacy"."ProductCategory_new");

ALTER TYPE "pharmacy"."ProductCategory" RENAME TO "ProductCategory_old";
ALTER TYPE "pharmacy"."ProductCategory_new" RENAME TO "ProductCategory";
DROP TYPE "pharmacy"."ProductCategory_old";

ALTER TABLE "pharmacy"."products" ALTER COLUMN "category" SET DEFAULT 'NON_PHARMACEUTICAL';

COMMIT;

-- ─── 2. Remove ControlledType (subsumed by category) ───────────────────────
ALTER TABLE "pharmacy"."prescriptions" DROP COLUMN "controlled_type";
DROP TYPE "pharmacy"."ControlledType";

-- Cleanup legacy enum objects that may exist in the public schema from the
-- initial multi-schema setup. They are not referenced by the current model.
DROP TYPE IF EXISTS public."ControlledType" CASCADE;
DROP TYPE IF EXISTS public."ProductCategory" CASCADE;

-- ─── 3. Add indexes for common query patterns ────────────────────────────
CREATE INDEX "products_deleted_at_idx" ON "pharmacy"."products"("deleted_at");
CREATE INDEX "products_category_idx" ON "pharmacy"."products"("category");
CREATE INDEX "products_dci_name_idx" ON "pharmacy"."products"("dci_name");
CREATE INDEX "products_commercial_name_idx" ON "pharmacy"."products"("commercial_name");

-- NOTE: barcode already has a unique constraint from the initial schema.
-- That satisfies the DB-level duplicate-barcode defense required by PMS-004-DB.
