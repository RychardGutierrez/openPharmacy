-- SIAT-10: cache of verificarNit answers per buyer NIT.

-- CreateTable
CREATE TABLE "siat"."siat_nit_verifications" (
    "nit" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "codigo_estado" INTEGER,
    "messages" JSONB,
    "verified_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siat_nit_verifications_pkey" PRIMARY KEY ("nit")
);
