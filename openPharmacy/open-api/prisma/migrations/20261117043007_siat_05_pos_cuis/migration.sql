-- SIAT-05: shift -> point of sale link, and point-of-sale closure date.
-- The generated DROP INDEX for pharmacy.sales_status_created_at_dashboard_idx was removed (pre-existing drift, see SIAT_Pending.md M2).

-- AlterTable
ALTER TABLE "auth"."shifts" ADD COLUMN     "point_of_sale_id" UUID;

-- AlterTable
ALTER TABLE "siat"."siat_points_of_sale" ADD COLUMN     "closed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "shifts_point_of_sale_id_status_idx" ON "auth"."shifts"("point_of_sale_id", "status");

-- AddForeignKey
ALTER TABLE "auth"."shifts" ADD CONSTRAINT "shifts_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "siat"."siat_points_of_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
