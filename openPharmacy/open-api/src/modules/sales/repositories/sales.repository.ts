import { Injectable } from '@nestjs/common';
import { Prisma, Sale, SaleItem, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.SaleUncheckedCreateInput,
  ): Promise<Sale> {
    return tx.sale.create({ data });
  }

  createItemTx(
    tx: Prisma.TransactionClient,
    data: Prisma.SaleItemUncheckedCreateInput,
  ): Promise<SaleItem> {
    return tx.saleItem.create({ data });
  }

  nextReceiptNumberTx(tx: Prisma.TransactionClient): Promise<string> {
    return tx.$queryRaw<Array<{ receipt_number: bigint }>>`
      SELECT nextval('pharmacy.sale_receipt_number_seq') AS receipt_number
    `.then(([row]) => String(row.receipt_number).padStart(8, '0'));
  }

  findOne(id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: { include: { product: true, lot: true } },
      },
    });
  }

  findByReceiptNumber(receiptNumber: string) {
    return this.prisma.sale.findUnique({
      where: { receipt_number: receiptNumber },
      include: { saleItems: { include: { product: true, lot: true } } },
    });
  }

  findAll(page: number, pageSize: number) {
    const where: Prisma.SaleWhereInput = { status: SaleStatus.COMPLETED };
    return Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { saleItems: { include: { product: true, lot: true } } },
      }),
      this.prisma.sale.count({ where }),
    ]);
  }

  /**
   * Look up the sale and its line items inside a transaction, including
   * the product category. Used by the returns / cancellation flows to
   * validate eligibility and check controlled-substance restrictions.
   */
  findByIdWithItemsTx(
    tx: Prisma.TransactionClient,
    saleId: string,
  ): Promise<
    | (Sale & {
        saleItems: Array<
          SaleItem & {
            product: {
              id: string;
              category: import('@prisma/client').ProductCategory;
              commercial_name: string;
            };
          }
        >;
      })
    | null
  > {
    return tx.sale.findUnique({
      where: { id: saleId },
      include: {
        saleItems: { include: { product: true } },
      },
    });
  }

  /**
   * Lock the sale row so two concurrent cancellations cannot race against
   * each other or against a return targeting the same sale.
   */
  async lockByIdTx(
    tx: Prisma.TransactionClient,
    saleId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM pharmacy.sales WHERE id = ${saleId}::uuid FOR UPDATE`;
  }

  updateStatusTx(
    tx: Prisma.TransactionClient,
    saleId: string,
    status: SaleStatus,
  ): Promise<Sale> {
    return tx.sale.update({
      where: { id: saleId },
      data: { status },
    });
  }

  countReturnsBySaleTx(
    tx: Prisma.TransactionClient,
    saleId: string,
  ): Promise<number> {
    return tx.return.count({ where: { sale_id: saleId } });
  }
}
