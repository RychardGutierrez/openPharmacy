import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ResolvedBuyer } from './siat-buyer-rules';

const SEARCH_LIMIT = 10;

export interface CustomerView {
  id: string;
  docType: number;
  docNumber: string;
  complement: string | null;
  name: string;
  email: string | null;
}

/**
 * Buyers reused for autocomplete (`pharmacy.customers`, SIAT-10). Invoices keep their own buyer
 * snapshot, so updating a customer never changes an issued invoice.
 */
@Injectable()
export class SiatCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prefix search on the document number (indexed), at most 10 rows. */
  async search(docNumber: string, docType?: number): Promise<CustomerView[]> {
    const prefix = docNumber.trim().toUpperCase();
    if (!prefix) return [];
    const rows = await this.prisma.customer.findMany({
      where: {
        doc_number: { startsWith: prefix },
        ...(docType !== undefined ? { doc_type: docType } : {}),
      },
      orderBy: [{ doc_number: 'asc' }, { complement: 'asc' }],
      take: SEARCH_LIMIT,
      select: {
        id: true,
        doc_type: true,
        doc_number: true,
        complement: true,
        name: true,
        email: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      docType: row.doc_type,
      docNumber: row.doc_number,
      complement: row.complement === '' ? null : row.complement,
      name: row.name,
      email: row.email,
    }));
  }

  /**
   * Creates or refreshes the customer of an invoice, inside the invoice transaction (SIAT-14).
   * Anonymous (S/N) and special buyers are never stored. Returns the customer id, or null.
   */
  async upsertFromInvoice(
    tx: Prisma.TransactionClient,
    buyer: ResolvedBuyer,
  ): Promise<string | null> {
    if (buyer.kind !== 'IDENTIFIED') return null;
    const key = {
      doc_type: buyer.docType,
      doc_number: buyer.docNumber,
      complement: buyer.complement ?? '',
    };
    const customer = await tx.customer.upsert({
      where: { doc_type_doc_number_complement: key },
      create: { ...key, name: buyer.name, email: buyer.email },
      // A missing email on this sale does not erase the one already known.
      update: {
        name: buyer.name,
        ...(buyer.email ? { email: buyer.email } : {}),
      },
      select: { id: true },
    });
    return customer.id;
  }
}
