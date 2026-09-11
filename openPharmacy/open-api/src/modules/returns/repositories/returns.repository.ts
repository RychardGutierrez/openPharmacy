import { Injectable } from '@nestjs/common';
import { Prisma, Return, ReturnItem, SaleItem } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Data-access layer for the `pharmacy.returns` and `pharmacy.return_items`
 * tables.
 *
 * All write methods accept a Prisma `TransactionClient` so the caller
 * controls the transaction boundary. Aggregation helpers (`sumBySaleItems`)
 * are intentionally read-only and used during eligibility checks inside the
 * same transaction with row locks to keep counts consistent.
 */
@Injectable()
export class ReturnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.ReturnUncheckedCreateInput,
  ): Promise<Return> {
    return tx.return.create({ data });
  }

  createItemTx(
    tx: Prisma.TransactionClient,
    data: Prisma.ReturnItemUncheckedCreateInput,
  ): Promise<ReturnItem> {
    return tx.returnItem.create({ data });
  }

  findById(id: string) {
    return this.prisma.return.findUnique({
      where: { id },
      include: {
        returnItems: {
          include: {
            saleItem: { include: { product: true, lot: true } },
          },
        },
      },
    });
  }

  findBySaleId(saleId: string) {
    return this.prisma.return.findMany({
      where: { sale_id: saleId },
      orderBy: { created_at: 'asc' },
      include: { returnItems: true },
    });
  }

  /**
   * Paginated list of return / cancellation records with enough context to
   * render a summary view (receipt number, refund total, item count).
   */
  findAll(page: number, pageSize: number) {
    return Promise.all([
      this.prisma.return.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          sale: { select: { id: true, receipt_number: true } },
          user: { select: { id: true, full_name: true } },
          returnItems: {
            include: {
              saleItem: { select: { unit_price: true, quantity: true } },
            },
          },
        },
      }),
      this.prisma.return.count(),
    ]);
  }

  /**
   * Aggregate the total quantity already returned for each sale item id.
   * Used during a return to compute the remaining refundable quantity.
   */
  async sumBySaleItems(
    tx: Prisma.TransactionClient,
    saleItemIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await tx.returnItem.groupBy({
      by: ['sale_item_id'],
      where: { sale_item_id: { in: saleItemIds } },
      _sum: { quantity: true },
    });
    return new Map(
      rows.map((row) => [row.sale_item_id, Number(row._sum.quantity ?? 0)]),
    );
  }

  /**
   * Read-only variant of `sumBySaleItems` for lookups that happen outside a
   * transaction (e.g. the returns screen loading a sale by receipt number).
   */
  async sumBySaleItemsRead(
    saleItemIds: string[],
  ): Promise<Map<string, number>> {
    if (saleItemIds.length === 0) return new Map();

    const rows = await this.prisma.returnItem.groupBy({
      by: ['sale_item_id'],
      where: { sale_item_id: { in: saleItemIds } },
      _sum: { quantity: true },
    });
    return new Map(
      rows.map((row) => [row.sale_item_id, Number(row._sum.quantity ?? 0)]),
    );
  }

  /**
   * Lock the requested `sale_items` rows using `SELECT ... FOR UPDATE`. This
   * prevents two concurrent returns from racing against the cumulative
   * return quantity for the same line.
   *
   * The `IN (…)` list is built with `Prisma.join` over `Prisma.sql` fragments
   * so each id is bound as its own parameter. Building the placeholders as
   * a raw SQL string would produce unbound `$1, $2, …` tokens and fail with
   * `there is no parameter $1`.
   */
  async lockSaleItemsTx(
    tx: Prisma.TransactionClient,
    saleItemIds: string[],
  ): Promise<SaleItem[]> {
    if (saleItemIds.length === 0) return [];
    const ids = Prisma.join(saleItemIds.map((id) => Prisma.sql`${id}::uuid`));
    return tx.$queryRaw<Array<SaleItem>>`
      SELECT id, sale_id, product_id, lot_id, quantity, unit_price, line_total
      FROM pharmacy.sale_items
      WHERE id IN (${ids})
      ORDER BY id
      FOR UPDATE
    `;
  }
}
