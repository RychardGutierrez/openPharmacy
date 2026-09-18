/*
  Warnings:

  - You are about to drop the column `invoice_number` on the `purchase_orders` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "pharmacy"."MovementType" ADD VALUE 'PURCHASE';

-- AlterTable
ALTER TABLE "pharmacy"."purchase_orders" DROP COLUMN "invoice_number";

-- CreateTable
CREATE TABLE "pharmacy"."purchase_receivings" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "received_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receivings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."purchase_receiving_items" (
    "id" UUID NOT NULL,
    "receiving_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "qty_received" INTEGER NOT NULL,
    "lot_number" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "lot_id" UUID,

    CONSTRAINT "purchase_receiving_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_receivings_order_id_idx" ON "pharmacy"."purchase_receivings"("order_id");

-- CreateIndex
CREATE INDEX "purchase_receivings_received_by_idx" ON "pharmacy"."purchase_receivings"("received_by");

-- CreateIndex
CREATE INDEX "purchase_receiving_items_receiving_id_idx" ON "pharmacy"."purchase_receiving_items"("receiving_id");

-- CreateIndex
CREATE INDEX "purchase_receiving_items_order_item_id_idx" ON "pharmacy"."purchase_receiving_items"("order_item_id");

-- CreateIndex
CREATE INDEX "purchase_receiving_items_lot_id_idx" ON "pharmacy"."purchase_receiving_items"("lot_id");

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_receivings" ADD CONSTRAINT "purchase_receivings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pharmacy"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_receivings" ADD CONSTRAINT "purchase_receivings_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_receiving_items" ADD CONSTRAINT "purchase_receiving_items_receiving_id_fkey" FOREIGN KEY ("receiving_id") REFERENCES "pharmacy"."purchase_receivings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_receiving_items" ADD CONSTRAINT "purchase_receiving_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "pharmacy"."order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_receiving_items" ADD CONSTRAINT "purchase_receiving_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "pharmacy"."lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
