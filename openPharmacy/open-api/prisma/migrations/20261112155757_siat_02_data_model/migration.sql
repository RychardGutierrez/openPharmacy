-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "siat";

-- CreateEnum
CREATE TYPE "siat"."SiatCufdSource" AS ENUM ('SCHEDULED', 'ON_DEMAND', 'EVENT');

-- CreateTable
CREATE TABLE "siat"."siat_branches" (
    "id" UUID NOT NULL,
    "codigo_sucursal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siat_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_points_of_sale" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "codigo_punto_venta" INTEGER NOT NULL,
    "tipo_punto_venta" INTEGER,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siat_points_of_sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_cuis" (
    "id" UUID NOT NULL,
    "point_of_sale_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "siat_cuis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_cufd" (
    "id" UUID NOT NULL,
    "point_of_sale_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigo_control" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "source" "siat"."SiatCufdSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "siat_cufd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_catalog_items" (
    "id" UUID NOT NULL,
    "catalog" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "extra" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siat_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_request_log" (
    "id" UUID NOT NULL,
    "correlation_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "environment" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "point_of_sale_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "unavailable_outcome" TEXT,
    "http_status" INTEGER,
    "request_xml" TEXT NOT NULL,
    "response_xml" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "siat_request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_time_offset" (
    "id" UUID NOT NULL,
    "siat_time" TIMESTAMP(3) NOT NULL,
    "server_time" TIMESTAMP(3) NOT NULL,
    "offset_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "siat_time_offset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "siat_branches_codigo_sucursal_key" ON "siat"."siat_branches"("codigo_sucursal");

-- CreateIndex
CREATE UNIQUE INDEX "siat_points_of_sale_branch_id_codigo_punto_venta_key" ON "siat"."siat_points_of_sale"("branch_id", "codigo_punto_venta");

-- CreateIndex
CREATE INDEX "siat_cuis_point_of_sale_id_requested_at_idx" ON "siat"."siat_cuis"("point_of_sale_id", "requested_at");

-- CreateIndex
CREATE INDEX "siat_cufd_point_of_sale_id_valid_until_idx" ON "siat"."siat_cufd"("point_of_sale_id", "valid_until");

-- CreateIndex
CREATE INDEX "siat_cufd_codigo_idx" ON "siat"."siat_cufd"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "siat_catalog_items_catalog_code_key" ON "siat"."siat_catalog_items"("catalog", "code");

-- CreateIndex
CREATE INDEX "siat_request_log_created_at_idx" ON "siat"."siat_request_log"("created_at");

-- CreateIndex
CREATE INDEX "siat_request_log_correlation_id_idx" ON "siat"."siat_request_log"("correlation_id");

-- CreateIndex
CREATE INDEX "siat_request_log_service_operation_created_at_idx" ON "siat"."siat_request_log"("service", "operation", "created_at");

-- CreateIndex
CREATE INDEX "siat_request_log_point_of_sale_id_created_at_idx" ON "siat"."siat_request_log"("point_of_sale_id", "created_at");

-- CreateIndex
CREATE INDEX "siat_time_offset_created_at_idx" ON "siat"."siat_time_offset"("created_at");

-- AddForeignKey
ALTER TABLE "siat"."siat_points_of_sale" ADD CONSTRAINT "siat_points_of_sale_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "siat"."siat_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_cuis" ADD CONSTRAINT "siat_cuis_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "siat"."siat_points_of_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_cufd" ADD CONSTRAINT "siat_cufd_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "siat"."siat_points_of_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_request_log" ADD CONSTRAINT "siat_request_log_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "siat"."siat_points_of_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One active CUIS per point of sale (SIAT-02). Partial index, so it is written by hand:
-- Prisma 7 cannot declare it and ignores partial indexes when it checks for drift.
CREATE UNIQUE INDEX "siat_cuis_one_active_per_pos"
  ON "siat"."siat_cuis" ("point_of_sale_id")
  WHERE "active";
