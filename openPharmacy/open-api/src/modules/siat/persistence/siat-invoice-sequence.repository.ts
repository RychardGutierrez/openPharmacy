import { Injectable } from '@nestjs/common';
import type { Prisma, SiatDocumentType } from '@prisma/client';

export interface ReserveInvoiceNumberInput {
  cuisId: string;
  pointOfSaleId: string;
  documentType: SiatDocumentType;
}

/**
 * Reserves invoice numbers (SIAT-09). One counter per CUIS and document type: numbers restart
 * with each new CUIS, and invoices and credit notes do not share a series.
 *
 * Call it **inside the transaction that inserts the invoice** (SIAT-14). The upsert locks the
 * counter row until that transaction ends, like `SELECT … FOR UPDATE`, so two sales never get
 * the same number. If the transaction rolls back, so does the number: a committed series has
 * no gaps. A number whose invoice SIAT rejected is not reused (the invoice is re-emitted with
 * a new number).
 */
@Injectable()
export class SiatInvoiceSequenceRepository {
  async reserveNumber(
    tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
    input: ReserveInvoiceNumberInput,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ reserved: number }>>`
      INSERT INTO "siat"."siat_invoice_sequences"
        ("cuis_id", "document_type", "point_of_sale_id", "next_number", "updated_at")
      VALUES
        (${input.cuisId}::uuid, ${input.documentType}::"siat"."SiatDocumentType",
         ${input.pointOfSaleId}::uuid, 2, now())
      ON CONFLICT ("cuis_id", "document_type") DO UPDATE
        SET "next_number" = "siat_invoice_sequences"."next_number" + 1,
            "updated_at" = now()
      RETURNING "next_number" - 1 AS "reserved"
    `;
    const reserved = rows[0]?.reserved;
    if (reserved === undefined) {
      throw new Error('Invoice number reservation returned no row');
    }
    return Number(reserved);
  }
}
