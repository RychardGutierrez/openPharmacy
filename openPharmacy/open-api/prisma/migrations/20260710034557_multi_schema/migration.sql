-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pharmacy";

-- CreateEnum
CREATE TYPE "auth"."UserRole" AS ENUM ('ADMIN', 'PHARMACIST', 'CASHIER', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "auth"."ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "pharmacy"."ProductCategory" AS ENUM ('OTC', 'PRESCRIPTION', 'CONTROLLED', 'COSMETIC', 'SUPPLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "pharmacy"."MovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT', 'TRANSFER', 'RETURN');

-- CreateEnum
CREATE TYPE "pharmacy"."PurchaseOrderStatus" AS ENUM ('PENDING', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "pharmacy"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'QR');

-- CreateEnum
CREATE TYPE "pharmacy"."SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "pharmacy"."ReturnType" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "pharmacy"."ControlledType" AS ENUM ('NONE', 'SCHEDULE_I', 'SCHEDULE_II', 'SCHEDULE_III', 'SCHEDULE_IV');

-- CreateTable
CREATE TABLE "auth"."roles" (
    "name" "auth"."UserRole" NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_name" "auth"."UserRole" NOT NULL,
    "reg_number" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."shifts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "opening_cash" DECIMAL(12,2) NOT NULL,
    "closing_cash" DECIMAL(12,2),
    "expected_cash" DECIMAL(12,2),
    "status" "auth"."ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."products" (
    "id" UUID NOT NULL,
    "dci_name" TEXT NOT NULL,
    "commercial_name" TEXT NOT NULL,
    "laboratory" TEXT,
    "form" TEXT,
    "concentration" TEXT,
    "barcode" TEXT,
    "category" "pharmacy"."ProductCategory" NOT NULL DEFAULT 'OTHER',
    "sale_price" DECIMAL(12,2) NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."lots" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lot_number" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "initial_qty" INTEGER NOT NULL,
    "current_qty" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."inventory_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "movement_type" "pharmacy"."MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "payment_terms" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."purchase_orders" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "pharmacy"."PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "invoice_number" TEXT,
    "order_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty_ordered" INTEGER NOT NULL,
    "qty_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "lot_number" TEXT,
    "expiry_date" DATE,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."sales" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "payment_method" "pharmacy"."PaymentMethod" NOT NULL,
    "cash_received" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "change_given" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "pharmacy"."SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."returns" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "return_type" "pharmacy"."ReturnType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."return_items" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."doctors" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "reg_number" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."prescriptions" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_ci" TEXT NOT NULL,
    "rx_date" DATE NOT NULL,
    "rx_number" TEXT NOT NULL,
    "image_path" TEXT,
    "controlled_type" "pharmacy"."ControlledType" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."config" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy"."_LotToProduct" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_LotToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_ci_key" ON "auth"."users"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "pharmacy"."products"("barcode");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_idx" ON "pharmacy"."inventory_movements"("product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_lot_id_idx" ON "pharmacy"."inventory_movements"("lot_id");

-- CreateIndex
CREATE INDEX "inventory_movements_user_id_idx" ON "pharmacy"."inventory_movements"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_nit_key" ON "pharmacy"."suppliers"("nit");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "pharmacy"."purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_user_id_idx" ON "pharmacy"."purchase_orders"("user_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "pharmacy"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "pharmacy"."order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receipt_number_key" ON "pharmacy"."sales"("receipt_number");

-- CreateIndex
CREATE INDEX "sales_shift_id_idx" ON "pharmacy"."sales"("shift_id");

-- CreateIndex
CREATE INDEX "sales_user_id_idx" ON "pharmacy"."sales"("user_id");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "pharmacy"."sales"("created_at");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "pharmacy"."sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "pharmacy"."sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sale_items_lot_id_idx" ON "pharmacy"."sale_items"("lot_id");

-- CreateIndex
CREATE INDEX "returns_sale_id_idx" ON "pharmacy"."returns"("sale_id");

-- CreateIndex
CREATE INDEX "returns_user_id_idx" ON "pharmacy"."returns"("user_id");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "pharmacy"."return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_sale_item_id_idx" ON "pharmacy"."return_items"("sale_item_id");

-- CreateIndex
CREATE INDEX "return_items_lot_id_idx" ON "pharmacy"."return_items"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_reg_number_key" ON "pharmacy"."doctors"("reg_number");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_rx_number_key" ON "pharmacy"."prescriptions"("rx_number");

-- CreateIndex
CREATE INDEX "prescriptions_sale_id_idx" ON "pharmacy"."prescriptions"("sale_id");

-- CreateIndex
CREATE INDEX "prescriptions_doctor_id_idx" ON "pharmacy"."prescriptions"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "config_key_key" ON "pharmacy"."config"("key");

-- CreateIndex
CREATE INDEX "_LotToProduct_B_index" ON "pharmacy"."_LotToProduct"("B");

-- AddForeignKey
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_role_name_fkey" FOREIGN KEY ("role_name") REFERENCES "auth"."roles"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."shifts" ADD CONSTRAINT "shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "pharmacy"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_movements" ADD CONSTRAINT "inventory_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "pharmacy"."lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."inventory_movements" ADD CONSTRAINT "inventory_movements_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "pharmacy"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pharmacy"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "pharmacy"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."sales" ADD CONSTRAINT "sales_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "auth"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."sales" ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pharmacy"."sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "pharmacy"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."sale_items" ADD CONSTRAINT "sale_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "pharmacy"."lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."returns" ADD CONSTRAINT "returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pharmacy"."sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."returns" ADD CONSTRAINT "returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy"."returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."return_items" ADD CONSTRAINT "return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "pharmacy"."sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."return_items" ADD CONSTRAINT "return_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "pharmacy"."lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."prescriptions" ADD CONSTRAINT "prescriptions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pharmacy"."sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "pharmacy"."doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."config" ADD CONSTRAINT "config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."_LotToProduct" ADD CONSTRAINT "_LotToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "pharmacy"."lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy"."_LotToProduct" ADD CONSTRAINT "_LotToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "pharmacy"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
