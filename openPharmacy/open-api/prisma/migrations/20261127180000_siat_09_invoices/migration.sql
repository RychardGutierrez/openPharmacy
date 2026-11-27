-- SIAT-09: invoices, items, buyer (customers) and per-CUIS number sequences.

-- CreateEnum
CREATE TYPE "siat"."SiatDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "siat"."SiatInvoiceStatus" AS ENUM ('PENDING', 'SENDING', 'VALID', 'OBSERVED', 'OFFLINE', 'IN_PACKAGE', 'CANCELLED');

-- AlterTable
ALTER TABLE "pharmacy"."sales" ADD COLUMN     "invoice_id" UUID,
ADD COLUMN     "requires_invoice" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pharmacy"."customers" (
    "id" UUID NOT NULL,
    "doc_type" INTEGER NOT NULL,
    "doc_number" TEXT NOT NULL,
    "complement" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_invoices" (
    "id" UUID NOT NULL,
    "document_type" "siat"."SiatDocumentType" NOT NULL,
    "status" "siat"."SiatInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "sale_id" UUID,
    "return_id" UUID,
    "original_invoice_id" UUID,
    "replaces_invoice_id" UUID,
    "point_of_sale_id" UUID NOT NULL,
    "cuis_id" UUID NOT NULL,
    "cufd_id" UUID NOT NULL,
    "numero_factura" INTEGER NOT NULL,
    "cuf" TEXT,
    "fecha_emision" TIMESTAMP(3),
    "tipo_emision" INTEGER NOT NULL DEFAULT 1,
    "codigo_documento_sector" INTEGER NOT NULL DEFAULT 1,
    "customer_id" UUID,
    "buyer_doc_type" INTEGER NOT NULL,
    "buyer_doc_number" TEXT NOT NULL,
    "buyer_complement" TEXT,
    "buyer_name" TEXT NOT NULL,
    "buyer_email" TEXT,
    "codigo_cliente" TEXT,
    "codigo_excepcion" INTEGER,
    "sub_total_neto" DECIMAL(12,2) NOT NULL,
    "descuento_adicional" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_gift_card" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_precio_neto" DECIMAL(12,2) NOT NULL,
    "iva" DECIMAL(12,2) NOT NULL,
    "monto_a_pagar" DECIMAL(12,2) NOT NULL,
    "codigo_moneda" INTEGER NOT NULL DEFAULT 1,
    "tipo_cambio" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "monto_total_moneda" DECIMAL(12,2) NOT NULL,
    "codigo_metodo_pago" INTEGER NOT NULL,
    "numero_tarjeta_masked" TEXT,
    "leyenda" TEXT,
    "usuario" TEXT NOT NULL,
    "xml" TEXT,
    "xml_hash" TEXT,
    "siat_reception_code" TEXT,
    "observations" JSONB,
    "event_id" UUID,
    "package_id" UUID,
    "cafc" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "validated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siat_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "sale_item_id" UUID,
    "return_item_id" UUID,
    "product_id" UUID,
    "actividad_economica" TEXT NOT NULL,
    "codigo_producto_sin" TEXT NOT NULL,
    "codigo_producto" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "unidad_medida" INTEGER NOT NULL,
    "precio_neto_unitario" DECIMAL(12,2) NOT NULL,
    "monto_descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sub_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "siat_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siat"."siat_invoice_sequences" (
    "cuis_id" UUID NOT NULL,
    "document_type" "siat"."SiatDocumentType" NOT NULL,
    "point_of_sale_id" UUID NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siat_invoice_sequences_pkey" PRIMARY KEY ("cuis_id","document_type")
);

-- CreateIndex
CREATE INDEX "customers_doc_number_idx" ON "pharmacy"."customers"("doc_number");

-- CreateIndex
CREATE UNIQUE INDEX "customers_doc_type_doc_number_complement_key" ON "pharmacy"."customers"("doc_type", "doc_number", "complement");

-- CreateIndex
CREATE UNIQUE INDEX "siat_invoices_cuf_key" ON "siat"."siat_invoices"("cuf");

-- CreateIndex
CREATE INDEX "siat_invoices_status_locked_until_idx" ON "siat"."siat_invoices"("status", "locked_until");

-- CreateIndex
CREATE INDEX "siat_invoices_sale_id_idx" ON "siat"."siat_invoices"("sale_id");

-- CreateIndex
CREATE INDEX "siat_invoices_return_id_idx" ON "siat"."siat_invoices"("return_id");

-- CreateIndex
CREATE INDEX "siat_invoices_point_of_sale_id_fecha_emision_idx" ON "siat"."siat_invoices"("point_of_sale_id", "fecha_emision");

-- CreateIndex
CREATE UNIQUE INDEX "siat_invoices_point_of_sale_id_cuis_id_document_type_numero_key" ON "siat"."siat_invoices"("point_of_sale_id", "cuis_id", "document_type", "numero_factura");

-- CreateIndex
CREATE UNIQUE INDEX "siat_invoice_items_invoice_id_line_number_key" ON "siat"."siat_invoice_items"("invoice_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_id_key" ON "pharmacy"."sales"("invoice_id");

-- AddForeignKey
ALTER TABLE "pharmacy"."sales" ADD CONSTRAINT "sales_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "siat"."siat_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pharmacy"."sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy"."returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "siat"."siat_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_replaces_invoice_id_fkey" FOREIGN KEY ("replaces_invoice_id") REFERENCES "siat"."siat_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "siat"."siat_points_of_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_cuis_id_fkey" FOREIGN KEY ("cuis_id") REFERENCES "siat"."siat_cuis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_cufd_id_fkey" FOREIGN KEY ("cufd_id") REFERENCES "siat"."siat_cufd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoices" ADD CONSTRAINT "siat_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "pharmacy"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoice_items" ADD CONSTRAINT "siat_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "siat"."siat_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoice_sequences" ADD CONSTRAINT "siat_invoice_sequences_cuis_id_fkey" FOREIGN KEY ("cuis_id") REFERENCES "siat"."siat_cuis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siat"."siat_invoice_sequences" ADD CONSTRAINT "siat_invoice_sequences_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "siat"."siat_points_of_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Document shape. Hand-written: Prisma cannot express CHECK constraints.
ALTER TABLE "siat"."siat_invoices"
  ADD CONSTRAINT "siat_invoices_tipo_emision_check" CHECK ("tipo_emision" IN (1, 2)),
  ADD CONSTRAINT "siat_invoices_document_links_check" CHECK (
    ("document_type" = 'INVOICE' AND "sale_id" IS NOT NULL)
    OR ("document_type" = 'CREDIT_NOTE' AND "return_id" IS NOT NULL AND "original_invoice_id" IS NOT NULL)
  );

-- Never update what SIAT received. Once `siat_reception_code` is set, the content columns are
-- frozen. Status, attempts, cancellation and package fields stay writable. Corrections are a
-- cancellation plus a new invoice, or a credit note.
CREATE OR REPLACE FUNCTION "siat"."siat_invoices_freeze_received"() RETURNS trigger AS $$
BEGIN
  IF OLD."siat_reception_code" IS NOT NULL AND (
       NEW."siat_reception_code" IS DISTINCT FROM OLD."siat_reception_code"
    OR NEW."document_type" IS DISTINCT FROM OLD."document_type"
    OR NEW."sale_id" IS DISTINCT FROM OLD."sale_id"
    OR NEW."return_id" IS DISTINCT FROM OLD."return_id"
    OR NEW."original_invoice_id" IS DISTINCT FROM OLD."original_invoice_id"
    OR NEW."point_of_sale_id" IS DISTINCT FROM OLD."point_of_sale_id"
    OR NEW."cuis_id" IS DISTINCT FROM OLD."cuis_id"
    OR NEW."cufd_id" IS DISTINCT FROM OLD."cufd_id"
    OR NEW."numero_factura" IS DISTINCT FROM OLD."numero_factura"
    OR NEW."cuf" IS DISTINCT FROM OLD."cuf"
    OR NEW."fecha_emision" IS DISTINCT FROM OLD."fecha_emision"
    OR NEW."tipo_emision" IS DISTINCT FROM OLD."tipo_emision"
    OR NEW."buyer_doc_type" IS DISTINCT FROM OLD."buyer_doc_type"
    OR NEW."buyer_doc_number" IS DISTINCT FROM OLD."buyer_doc_number"
    OR NEW."buyer_complement" IS DISTINCT FROM OLD."buyer_complement"
    OR NEW."buyer_name" IS DISTINCT FROM OLD."buyer_name"
    OR NEW."codigo_excepcion" IS DISTINCT FROM OLD."codigo_excepcion"
    OR NEW."sub_total_neto" IS DISTINCT FROM OLD."sub_total_neto"
    OR NEW."descuento_adicional" IS DISTINCT FROM OLD."descuento_adicional"
    OR NEW."monto_gift_card" IS DISTINCT FROM OLD."monto_gift_card"
    OR NEW."total_precio_neto" IS DISTINCT FROM OLD."total_precio_neto"
    OR NEW."iva" IS DISTINCT FROM OLD."iva"
    OR NEW."monto_a_pagar" IS DISTINCT FROM OLD."monto_a_pagar"
    OR NEW."monto_total_moneda" IS DISTINCT FROM OLD."monto_total_moneda"
    OR NEW."codigo_metodo_pago" IS DISTINCT FROM OLD."codigo_metodo_pago"
    OR NEW."xml" IS DISTINCT FROM OLD."xml"
    OR NEW."xml_hash" IS DISTINCT FROM OLD."xml_hash"
  ) THEN
    RAISE EXCEPTION 'siat_invoices % was received by SIAT and its content cannot change', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "siat_invoices_freeze_received"
  BEFORE UPDATE ON "siat"."siat_invoices"
  FOR EACH ROW EXECUTE FUNCTION "siat"."siat_invoices_freeze_received"();

-- Line snapshots are frozen as soon as the invoice has its XML.
CREATE OR REPLACE FUNCTION "siat"."siat_invoice_items_freeze"() RETURNS trigger AS $$
DECLARE
  parent_id UUID := COALESCE(OLD."invoice_id", NEW."invoice_id");
BEGIN
  IF EXISTS (SELECT 1 FROM "siat"."siat_invoices" WHERE "id" = parent_id AND "xml" IS NOT NULL) THEN
    RAISE EXCEPTION 'siat_invoice_items of invoice % are frozen: the invoice already has its XML', parent_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "siat_invoice_items_freeze"
  BEFORE UPDATE OR DELETE ON "siat"."siat_invoice_items"
  FOR EACH ROW EXECUTE FUNCTION "siat"."siat_invoice_items_freeze"();
