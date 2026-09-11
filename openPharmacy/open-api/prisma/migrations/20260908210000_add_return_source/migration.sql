-- CreateEnum
CREATE TYPE "pharmacy"."ReturnSource" AS ENUM ('RETURN', 'CANCELLATION');

-- AlterTable
ALTER TABLE "pharmacy"."returns" ADD COLUMN "source" "pharmacy"."ReturnSource" NOT NULL DEFAULT 'RETURN';

-- CreateIndex
CREATE INDEX "returns_source_idx" ON "pharmacy"."returns"("source");
