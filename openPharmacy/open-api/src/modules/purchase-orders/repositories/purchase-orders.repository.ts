import { Injectable } from '@nestjs/common';
import { Prisma, PurchaseOrder, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type OrderItemWithProduct = Prisma.OrderItemGetPayload<{
  include: { product: true };
}>;

export type PurchaseOrderWithItems = Prisma.PurchaseOrderGetPayload<{
  include: {
    orderItems: { include: { product: true } };
    supplier: true;
    user: true;
  };
}>;

@Injectable()
export class PurchaseOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.PurchaseOrderUncheckedCreateInput,
  ): Promise<PurchaseOrder> {
    return tx.purchaseOrder.create({ data });
  }

  createItemTx(
    tx: Prisma.TransactionClient,
    data: Prisma.OrderItemUncheckedCreateInput,
  ): Promise<Prisma.OrderItemGetPayload<Record<string, never>>> {
    return tx.orderItem.create({ data });
  }

  async findByIdWithItemsTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<PurchaseOrderWithItems | null> {
    return tx.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        user: true,
        orderItems: { include: { product: true } },
      },
    });
  }

  async lockByIdTx(tx: Prisma.TransactionClient, id: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM pharmacy.purchase_orders WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async lockItemsTx(
    tx: Prisma.TransactionClient,
    orderItemIds: string[],
  ): Promise<void> {
    if (orderItemIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM pharmacy.order_items
      WHERE id IN (${Prisma.join(orderItemIds)})
      FOR UPDATE
    `;
  }

  findItemsByIdsTx(
    tx: Prisma.TransactionClient,
    orderItemIds: string[],
  ): Promise<OrderItemWithProduct[]> {
    return tx.orderItem.findMany({
      where: { id: { in: orderItemIds } },
      include: { product: true },
    });
  }

  updateStatusTx(
    tx: Prisma.TransactionClient,
    id: string,
    status: PurchaseOrderStatus,
  ): Promise<PurchaseOrder> {
    return tx.purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  updateItemReceivedTx(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    qtyReceived: number,
  ): Promise<Prisma.OrderItemGetPayload<Record<string, never>>> {
    return tx.orderItem.update({
      where: { id: orderItemId },
      data: { qty_received: qtyReceived },
    });
  }

  findAll(query: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    /** Free-text search across order id, supplier name, and supplier NIT. */
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<[PurchaseOrderWithItems[], number]> {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplier_id = query.supplierId;

    const trimmed = query.q?.trim();
    if (trimmed) {
      // Order ids are UUIDs. Prisma's UUID filter only accepts `equals`,
      // so a UUID-shaped query matches by exact id; everything else
      // falls back to the supplier field searches.
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          trimmed,
        );
      const supplierFilters: Prisma.SupplierWhereInput[] = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { nit: { contains: trimmed, mode: 'insensitive' } },
        { contact_person: { contains: trimmed, mode: 'insensitive' } },
      ];
      const supplierMatch: Prisma.PurchaseOrderWhereInput = {
        supplier: { OR: supplierFilters },
      };
      where.OR = isUuid
        ? [{ id: { equals: trimmed.toLowerCase() } }, supplierMatch]
        : [supplierMatch];
    }

    return Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          supplier: true,
          user: true,
          orderItems: { include: { product: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
  }

  findById(id: string): Promise<PurchaseOrderWithItems | null> {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        user: true,
        orderItems: { include: { product: true } },
        receivings: {
          include: {
            items: {
              include: { lot: true, orderItem: { include: { product: true } } },
            },
            user: true,
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  findByIdWithItems(id: string): Promise<PurchaseOrderWithItems | null> {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        user: true,
        orderItems: { include: { product: true } },
      },
    });
  }

  /**
   * Find the most recent unit cost paid to the given supplier for the given
   * product, joining through `purchase_receiving_items → purchase_receivings`.
   *
   * Returns the unit cost and the date it was paid, or `null` when the
   * supplier/product pair has never been received before.
   */
  async findLastSupplierCost(
    supplierId: string,
    productId: string,
  ): Promise<{ unitCost: number; invoiceDate: Date } | null> {
    const item = await this.prisma.purchaseReceivingItem.findFirst({
      where: {
        orderItem: {
          product_id: productId,
          order: { supplier_id: supplierId },
        },
      },
      orderBy: { receiving: { invoice_date: 'desc' } },
      include: { receiving: { select: { invoice_date: true } } },
    });
    if (!item) return null;
    return {
      unitCost: Number(item.unit_cost),
      invoiceDate: item.receiving.invoice_date,
    };
  }

  /**
   * Delete the line items of a purchase order inside the caller's transaction.
   * Used by `update()` to replace the line list atomically.
   */
  deleteItemsTx(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<Prisma.BatchPayload> {
    return tx.orderItem.deleteMany({ where: { order_id: orderId } });
  }

  createItemInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.OrderItemUncheckedCreateInput,
  ): Promise<Prisma.OrderItemGetPayload<Record<string, never>>> {
    return tx.orderItem.create({ data });
  }

  updateHeaderTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.PurchaseOrderUncheckedUpdateInput,
  ): Promise<PurchaseOrder> {
    return tx.purchaseOrder.update({ where: { id }, data });
  }
}
