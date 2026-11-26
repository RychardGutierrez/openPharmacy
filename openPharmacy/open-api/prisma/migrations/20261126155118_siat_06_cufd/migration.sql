-- SIAT-06: CUFD codigoInterno (V3) and the CUIS each CUFD was requested with.
-- No DROP INDEX for pharmacy.sales_status_created_at_dashboard_idx (pre-existing drift, see SIAT_Pending.md M2).

-- AlterTable
ALTER TABLE "siat"."siat_cufd" ADD COLUMN     "codigo_interno" TEXT,
ADD COLUMN     "cuis_id" UUID;

-- AddForeignKey
ALTER TABLE "siat"."siat_cufd" ADD CONSTRAINT "siat_cufd_cuis_id_fkey" FOREIGN KEY ("cuis_id") REFERENCES "siat"."siat_cuis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
