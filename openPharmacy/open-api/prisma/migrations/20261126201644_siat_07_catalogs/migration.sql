-- AlterTable
ALTER TABLE "siat"."siat_catalog_items" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parent_code" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- Backfill existing rows (the pilot may already hold synced catalogs), then require it.
UPDATE "siat"."siat_catalog_items" SET "updated_at" = "synced_at" WHERE "updated_at" IS NULL;
ALTER TABLE "siat"."siat_catalog_items" ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateTable
CREATE TABLE "siat"."siat_catalog_sync" (
    "catalog" TEXT NOT NULL,
    "last_attempt_at" TIMESTAMP(3) NOT NULL,
    "last_success_at" TIMESTAMP(3),
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "point_of_sale_id" UUID,

    CONSTRAINT "siat_catalog_sync_pkey" PRIMARY KEY ("catalog")
);

-- CreateIndex
CREATE INDEX "siat_catalog_items_catalog_active_parent_code_idx" ON "siat"."siat_catalog_items"("catalog", "active", "parent_code");
