-- CreateEnum
CREATE TYPE "pharmacy"."ReportType" AS ENUM ('SALES_SUMMARY', 'SALES_DETAIL', 'INVENTORY_MOVEMENTS', 'STOCK_SNAPSHOT', 'EXPIRY', 'PURCHASES', 'RETURNS');

-- CreateEnum
CREATE TYPE "pharmacy"."ReportFormat" AS ENUM ('XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "pharmacy"."ReportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "pharmacy"."report_jobs" (
    "id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "report_type" "pharmacy"."ReportType" NOT NULL,
    "format" "pharmacy"."ReportFormat" NOT NULL,
    "status" "pharmacy"."ReportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "locked_until" TIMESTAMP(3),
    "worker_id" TEXT,
    "file_name" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "result_data" BYTEA,
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_jobs_status_requested_at_idx" ON "pharmacy"."report_jobs"("status", "requested_at");

-- CreateIndex
CREATE INDEX "report_jobs_requested_by_requested_at_idx" ON "pharmacy"."report_jobs"("requested_by", "requested_at");

-- CreateIndex
CREATE INDEX "report_jobs_expires_at_idx" ON "pharmacy"."report_jobs"("expires_at");

-- AddForeignKey
ALTER TABLE "pharmacy"."report_jobs" ADD CONSTRAINT "report_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
