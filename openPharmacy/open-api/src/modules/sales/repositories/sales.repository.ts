import { Injectable } from '@nestjs/common';
import { Prisma, Sale, SaleItem } from '@prisma/client';
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
    const where: Prisma.SaleWhereInput = { status: 'COMPLETED' };
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
}
