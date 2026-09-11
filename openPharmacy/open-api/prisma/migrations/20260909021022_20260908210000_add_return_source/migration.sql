-- DropForeignKey
ALTER TABLE "pharmacy"."return_items" DROP CONSTRAINT "return_items_sale_item_id_lot_id_fkey";

-- DropIndex
DROP INDEX "pharmacy"."sale_items_id_lot_id_key";
