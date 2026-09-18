/*
  Warnings:

  - Made the column `lot_id` on table `purchase_receiving_items` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "pharmacy"."purchase_receiving_items" DROP CONSTRAINT "purchase_receiving_items_lot_id_fkey";

-- AlterTable
ALTER TABLE "pharmacy"."purchase_receiving_items" ALTER COLUMN "lot_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_receiving_items" ADD CONSTRAINT "purchase_receiving_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "pharmacy"."lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense-in-depth CHECK constraints for purchase order receiving
ALTER TABLE "pharmacy"."order_items"
  ADD CONSTRAINT "order_items_qty_ordered_positive_chk" CHECK ("qty_ordered" > 0),
  ADD CONSTRAINT "order_items_qty_received_non_negative_chk" CHECK ("qty_received" >= 0),
  ADD CONSTRAINT "order_items_qty_received_not_exceed_ordered_chk" CHECK ("qty_received" <= "qty_ordered");

ALTER TABLE "pharmacy"."purchase_receiving_items"
  ADD CONSTRAINT "purchase_receiving_items_qty_received_positive_chk" CHECK ("qty_received" > 0);
