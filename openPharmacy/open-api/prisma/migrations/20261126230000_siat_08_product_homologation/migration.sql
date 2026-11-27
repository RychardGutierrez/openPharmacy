-- SIAT-08: SIN homologation codes on products and per-category defaults.

-- AlterTable
ALTER TABLE "pharmacy"."products" ADD COLUMN     "sin_activity_code" TEXT,
ADD COLUMN     "sin_product_code" TEXT,
ADD COLUMN     "sin_unit_code" TEXT;

-- CreateTable
CREATE TABLE "pharmacy"."product_sin_defaults" (
    "category" "pharmacy"."ProductCategory" NOT NULL,
    "sin_activity_code" TEXT NOT NULL,
    "sin_product_code" TEXT NOT NULL,
    "sin_unit_code" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_sin_defaults_pkey" PRIMARY KEY ("category")
);

-- CreateIndex
CREATE INDEX "products_sin_product_code_idx" ON "pharmacy"."products"("sin_product_code");
