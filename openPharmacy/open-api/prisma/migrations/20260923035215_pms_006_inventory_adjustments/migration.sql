-- CreateEnum
CREATE TYPE "pharmacy"."AdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "pharmacy"."AdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "pharmacy"."MovementType" ADD VALUE 'SALE';
ALTER TYPE "pharmacy"."MovementType" ADD VALUE 'DAMAGE';
ALTER TYPE "pharmacy"."MovementType" ADD VALUE 'EXPIRED';
ALTER TYPE "pharmacy"."MovementType" ADD VALUE 'THEFT_LOSS';
ALTER TYPE "pharmacy"."MovementType" ADD VALUE 'MANUAL_ADJUSTMENT';

-- CreateTable
CREATE TABLE "pharmacy"."inventory_adjustments" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" "pharmacy"."AdjustmentDirection" NOT NULL,
    "movement_type" "pharmacy"."MovementType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "pharmacy"."AdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_adjustments_product_id_idx" ON "pharmacy"."inventory_adjustments"("product_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_lot_id_idx" ON "pharmacy"."inventory_adjustments"("lot_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_requested_by_idx" ON "pharmacy"."inventory_adjustments"("requested_by");

-- CreateIndex
CREATE INDEX "inventory_adjustments_status_idx" ON "pharmacy"."inventory_adjustments"("status");

-- CreateIndex
CREATE INDEX "inventory_adjustments_approved_by_idx" ON "pharmacy"."inventory_adjustments"("approved_by");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_type_idx" ON "pharmacy"."inventory_movements"("movement_type");

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "pharmacy"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "pharmacy"."lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense-in-depth: movement quantities must be positive and lot stock must never go negative.
ALTER TABLE "pharmacy"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_positive_chk" CHECK ("quantity" > 0);

ALTER TABLE "pharmacy"."lots"
  ADD CONSTRAINT "lots_current_qty_non_negative_chk" CHECK ("current_qty" >= 0);
