import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { LastSupplierCostQueryDto } from './dto/last-supplier-cost-query.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { RequestMetadata } from '../users/users.service';

export interface PurchaseOrderLineResponse {
  id: string;
  productId: string;
  productName: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
}

export interface PurchaseOrderResponse {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierNit: string;
  userId: string;
  userName: string;
  userRole: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  items: PurchaseOrderLineResponse[];
  createdAt: Date;
}

export interface ReceivingLotResponse {
  lotId: string;
  lotNumber: string;
  productId: string;
  productName: string;
  qtyReceived: number;
  unitCost: number;
}

export interface PurchaseOrderReceivingResponse {
  receivingId: string;
  orderId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  receivedBy: string;
  status: PurchaseOrderStatus;
  lots: ReceivingLotResponse[];
  createdAt: Date;
}

export interface LastSupplierCostResponse {
  supplierId: string;
  productId: string;
  unitCost: number;
  invoiceDate: Date;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseOrders: PurchaseOrdersRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  async create(
    userId: string,
    dto: CreatePurchaseOrderDto,
    meta?: RequestMetadata,
  ): Promise<PurchaseOrderResponse> {
    const orderDate = new Date(dto.orderDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await this.purchaseOrders.createTx(tx, {
        supplier_id: dto.supplierId,
        user_id: userId,
        status: PurchaseOrderStatus.PENDING,
        order_date: orderDate,
      });

      const items = await Promise.all(
        dto.items.map((item) =>
          this.purchaseOrders.createItemTx(tx, {
            order_id: order.id,
            product_id: item.productId,
            qty_ordered: item.qtyOrdered,
            qty_received: 0,
            unit_cost: item.unitCost,
          }),
        ),
      );

      await this.audit.createInTx(tx, {
        userId,
        event: 'PURCHASE_ORDER_CREATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          orderId: order.id,
          supplierId: dto.supplierId,
          itemCount: items.length,
        },
      });

      return { order, items };
    });

    const fullOrder = await this.purchaseOrders.findByIdWithItems(
      created.order.id,
    );
    if (!fullOrder)
      throw new NotFoundException(
        `Purchase order ${created.order.id} not found`,
      );
    return this.toOrderResponse(fullOrder, fullOrder.orderItems);
  }

  async submit(
    userId: string,
    id: string,
    meta?: RequestMetadata,
  ): Promise<PurchaseOrderResponse> {
    await this.prisma.$transaction(async (tx) => {
      await this.purchaseOrders.lockByIdTx(tx, id);
      const order = await this.purchaseOrders.findByIdWithItemsTx(tx, id);
      if (!order) throw new NotFoundException(`Purchase order ${id} not found`);

      if (order.status !== PurchaseOrderStatus.PENDING) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'PURCHASE_ORDER_NOT_PENDING',
          message: `Only pending purchase orders can be submitted. Current status: ${order.status}`,
        });
      }

      if (order.orderItems.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'PURCHASE_ORDER_EMPTY',
          message: 'Cannot submit an empty purchase order',
        });
      }

      const updated = await this.purchaseOrders.updateStatusTx(
        tx,
        id,
        PurchaseOrderStatus.ORDERED,
      );

      await this.audit.createInTx(tx, {
        userId,
        event: 'PURCHASE_ORDER_SUBMITTED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { orderId: id },
      });

      return { order: updated, items: order.orderItems };
    });

    const fullOrder = await this.purchaseOrders.findByIdWithItems(id);
    if (!fullOrder)
      throw new NotFoundException(`Purchase order ${id} not found`);
    return this.toOrderResponse(fullOrder, fullOrder.orderItems);
  }

  /**
   * Update a `PENDING` purchase order. Replaces the line-item list and
   * optionally changes the supplier, order date, or reason. Rejected with
   * `400 PURCHASE_ORDER_NOT_PENDING` once the order has been submitted.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdatePurchaseOrderDto,
    meta?: RequestMetadata,
  ): Promise<PurchaseOrderResponse> {
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deleted_at: null, active: true },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = productIds.filter((p) => !found.has(p));
      throw new BadRequestException({
        statusCode: 400,
        code: 'PRODUCT_INACTIVE',
        message: `One or more products are missing, inactive, or deleted: ${missing.join(', ')}`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.purchaseOrders.lockByIdTx(tx, id);
      const order = await this.purchaseOrders.findByIdWithItemsTx(tx, id);
      if (!order) throw new NotFoundException(`Purchase order ${id} not found`);

      if (order.status !== PurchaseOrderStatus.PENDING) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'PURCHASE_ORDER_NOT_PENDING',
          message: `Only pending purchase orders can be edited. Current status: ${order.status}`,
        });
      }

      await this.purchaseOrders.updateHeaderTx(tx, id, {
        ...(dto.supplierId ? { supplier_id: dto.supplierId } : {}),
        ...(dto.orderDate ? { order_date: new Date(dto.orderDate) } : {}),
      });
      await this.purchaseOrders.deleteItemsTx(tx, id);

      await Promise.all(
        dto.items.map((item) =>
          this.purchaseOrders.createItemInTx(tx, {
            order_id: id,
            product_id: item.productId,
            qty_ordered: item.qtyOrdered,
            qty_received: 0,
            unit_cost: item.unitCost,
          }),
        ),
      );

      await this.audit.createInTx(tx, {
        userId,
        event: 'PURCHASE_ORDER_UPDATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          orderId: id,
          itemCount: dto.items.length,
          reason: dto.reason ?? null,
        },
      });
    });

    const fullOrder = await this.purchaseOrders.findByIdWithItems(id);
    if (!fullOrder)
      throw new NotFoundException(`Purchase order ${id} not found`);
    return this.toOrderResponse(fullOrder, fullOrder.orderItems);
  }

  /**
   * Look up the most recent unit cost paid to a given supplier for a given
   * product. Used by the product picker to pre-fill the next line cost.
   * Returns `null` when no history exists.
   */
  async findLastSupplierCost(
    query: LastSupplierCostQueryDto,
  ): Promise<LastSupplierCostResponse | null> {
    const result = await this.purchaseOrders.findLastSupplierCost(
      query.supplierId,
      query.productId,
    );
    if (!result) return null;
    return {
      supplierId: query.supplierId,
      productId: query.productId,
      unitCost: result.unitCost,
      invoiceDate: result.invoiceDate,
    };
  }

  async receive(
    userId: string,
    id: string,
    dto: ReceivePurchaseOrderDto,
    meta?: RequestMetadata,
  ): Promise<PurchaseOrderReceivingResponse> {
    const response = await this.prisma.$transaction(
      async (tx) => this.processReceivingTx(tx, userId, id, dto, meta),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return response;
  }

  private async processReceivingTx(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    dto: ReceivePurchaseOrderDto,
    meta?: RequestMetadata,
  ): Promise<PurchaseOrderReceivingResponse> {
    const invoiceDate = new Date(dto.invoiceDate);
    await this.purchaseOrders.lockByIdTx(tx, id);
    const order = await this.purchaseOrders.findByIdWithItemsTx(tx, id);
    if (!order) throw new NotFoundException(`Purchase order ${id} not found`);

    if (
      order.status !== PurchaseOrderStatus.ORDERED &&
      order.status !== PurchaseOrderStatus.PARTIAL
    ) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PURCHASE_ORDER_NOT_RECEIVABLE',
        message: `Goods can only be received for ordered or partially received purchase orders. Current status: ${order.status}`,
      });
    }

    const requestedByLine = this.aggregateRequestedQuantities(dto.items);
    const orderItemIds = [...requestedByLine.keys()];

    await this.purchaseOrders.lockItemsTx(tx, orderItemIds);
    const lockedItems = await this.purchaseOrders.findItemsByIdsTx(
      tx,
      orderItemIds,
    );
    if (lockedItems.length !== orderItemIds.length) {
      const found = new Set(lockedItems.map((i) => i.id));
      const missing = orderItemIds.filter((itemId) => !found.has(itemId));
      throw new BadRequestException({
        statusCode: 400,
        code: 'PURCHASE_ORDER_ITEM_NOT_FOUND',
        message: `Order item(s) not found: ${missing.join(', ')}`,
      });
    }

    const wrongOrder = lockedItems.find((item) => item.order_id !== id);
    if (wrongOrder) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PURCHASE_ORDER_ITEM_MISMATCH',
        message: `Order item ${wrongOrder.id} does not belong to purchase order ${id}`,
      });
    }

    this.validateQtyNotExceeded(lockedItems, requestedByLine);

    const receiving = await tx.purchaseReceiving.create({
      data: {
        order_id: id,
        invoice_number: dto.invoiceNumber,
        invoice_date: invoiceDate,
        received_by: userId,
      },
    });

    const lots: ReceivingLotResponse[] = [];
    const updatedQuantities = new Map<string, number>();

    for (const item of dto.items) {
      const orderItem = lockedItems.find((i) => i.id === item.orderItemId)!;
      const expiryDate = new Date(item.expiryDate);
      this.assertFutureOrTodayExpiry(expiryDate);

      const lot = await this.createOrIncrementLot(tx, {
        productId: orderItem.product_id,
        lotNumber: item.lotNumber,
        expiryDate,
        quantity: item.qtyReceived,
        unitCost: item.unitCost,
      });

      await tx.purchaseReceivingItem.create({
        data: {
          receiving_id: receiving.id,
          order_item_id: item.orderItemId,
          qty_received: item.qtyReceived,
          lot_number: item.lotNumber,
          expiry_date: expiryDate,
          unit_cost: item.unitCost,
          lot_id: lot.id,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          product_id: orderItem.product_id,
          lot_id: lot.id,
          user_id: userId,
          movementType: 'PURCHASE',
          quantity: item.qtyReceived,
          reason: `PO-${id} / INV-${dto.invoiceNumber}`,
        },
      });

      const previous =
        updatedQuantities.get(item.orderItemId) ?? orderItem.qty_received;
      updatedQuantities.set(item.orderItemId, previous + item.qtyReceived);

      lots.push({
        lotId: lot.id,
        lotNumber: lot.lot_number,
        productId: orderItem.product_id,
        productName: orderItem.product.commercial_name,
        qtyReceived: item.qtyReceived,
        unitCost: Number(lot.unit_cost),
      });
    }

    for (const [orderItemId, qtyReceived] of updatedQuantities.entries()) {
      await this.purchaseOrders.updateItemReceivedTx(
        tx,
        orderItemId,
        qtyReceived,
      );
    }

    const newStatus = this.computeOrderStatus(
      order.orderItems,
      updatedQuantities,
    );
    await this.purchaseOrders.updateStatusTx(tx, id, newStatus);

    await this.audit.createInTx(tx, {
      userId,
      event: 'PURCHASE_ORDER_RECEIVED',
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: {
        orderId: id,
        receivingId: receiving.id,
        invoiceNumber: dto.invoiceNumber,
        invoiceDate: dto.invoiceDate,
        lotCount: lots.length,
      },
    });

    return {
      receivingId: receiving.id,
      orderId: id,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate,
      receivedBy: userId,
      status: newStatus,
      lots,
      createdAt: receiving.created_at,
    };
  }

  async findAll(query: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    data: PurchaseOrderResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const [orders, total] = await this.purchaseOrders.findAll(query);
    return {
      data: orders.map((order) =>
        this.toOrderResponse(order, order.orderItems),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string): Promise<PurchaseOrderResponse> {
    const order = await this.purchaseOrders.findById(id);
    if (!order) throw new NotFoundException(`Purchase order ${id} not found`);
    return this.toOrderResponse(order, order.orderItems);
  }

  private aggregateRequestedQuantities(
    items: ReceivePurchaseOrderDto['items'],
  ): Map<string, number> {
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(
        item.orderItemId,
        (totals.get(item.orderItemId) ?? 0) + item.qtyReceived,
      );
    }
    return totals;
  }

  private validateQtyNotExceeded(
    orderItems: { id: string; qty_ordered: number; qty_received: number }[],
    requestedByLine: Map<string, number>,
  ): void {
    for (const orderItem of orderItems) {
      const requested = requestedByLine.get(orderItem.id) ?? 0;
      const projected = orderItem.qty_received + requested;
      if (projected > orderItem.qty_ordered) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'PURCHASE_ORDER_QTY_EXCEEDED',
          message: `Cannot receive ${requested} units for order item ${orderItem.id}; ordered ${orderItem.qty_ordered}, already received ${orderItem.qty_received}`,
        });
      }
    }
  }

  private computeOrderStatus(
    orderItems: { id: string; qty_ordered: number; qty_received: number }[],
    updatedQuantities: Map<string, number>,
  ): PurchaseOrderStatus {
    const totals = orderItems.map(
      (item) => updatedQuantities.get(item.id) ?? item.qty_received,
    );
    const fullyReceived = totals.every(
      (qty, idx) => qty >= orderItems[idx].qty_ordered,
    );
    const partiallyReceived = totals.some((qty) => qty > 0);

    if (fullyReceived) return PurchaseOrderStatus.RECEIVED;
    if (partiallyReceived) return PurchaseOrderStatus.PARTIAL;
    return PurchaseOrderStatus.ORDERED;
  }

  private async createOrIncrementLot(
    tx: Prisma.TransactionClient,
    payload: {
      productId: string;
      lotNumber: string;
      expiryDate: Date;
      quantity: number;
      unitCost: number;
    },
  ): Promise<{ id: string; lot_number: string; unit_cost: Prisma.Decimal }> {
    const existing = await tx.lot.findUnique({
      where: {
        product_id_lot_number: {
          product_id: payload.productId,
          lot_number: payload.lotNumber,
        },
      },
    });

    if (existing) {
      if (existing.voided_at) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'LOT_VOIDED',
          message: `Lot ${payload.lotNumber} has been voided and cannot receive more stock`,
        });
      }

      const existingExpiry = existing.expiry_date.toISOString().split('T')[0];
      const receivedExpiry = payload.expiryDate.toISOString().split('T')[0];
      if (existingExpiry !== receivedExpiry) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'LOT_EXPIRY_MISMATCH',
          message: `Lot ${payload.lotNumber} already exists with expiry ${existingExpiry}; received expiry ${receivedExpiry} does not match`,
        });
      }

      if (
        Number(existing.unit_cost).toFixed(2) !== payload.unitCost.toFixed(2)
      ) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'LOT_COST_MISMATCH',
          message: `Lot ${payload.lotNumber} already exists with unit cost ${Number(existing.unit_cost)}; received cost ${payload.unitCost} does not match`,
        });
      }

      await tx.lot.update({
        where: { id: existing.id },
        data: {
          initial_qty: { increment: payload.quantity },
          current_qty: { increment: payload.quantity },
        },
      });

      return existing;
    }

    return tx.lot.create({
      data: {
        product_id: payload.productId,
        lot_number: payload.lotNumber,
        expiry_date: payload.expiryDate,
        initial_qty: payload.quantity,
        current_qty: payload.quantity,
        unit_cost: payload.unitCost,
      },
    });
  }

  private assertFutureOrTodayExpiry(expiryDate: Date): void {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);

    if (expiry < today) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'EXPIRY_DATE_IN_PAST',
        field: 'expiryDate',
        message: 'Expiry date cannot be in the past for active stock',
      });
    }
  }

  private toOrderResponse(
    order: {
      id: string;
      supplier_id: string;
      user_id: string;
      status: PurchaseOrderStatus;
      order_date: Date;
      created_at: Date;
      supplier: { name: string; nit: string };
      user: { full_name: string; roleName: string };
    },
    items: {
      id: string;
      product_id: string;
      product: { commercial_name: string };
      qty_ordered: number;
      qty_received: number;
      unit_cost: Prisma.Decimal;
    }[],
  ): PurchaseOrderResponse {
    return {
      id: order.id,
      supplierId: order.supplier_id,
      supplierName: order.supplier.name,
      supplierNit: order.supplier?.nit ?? "",
      userId: order.user_id,
      userName: order.user?.full_name ?? "",
      userRole: order.user?.roleName ?? "",
      status: order.status,
      orderDate: order.order_date,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product.commercial_name,
        qtyOrdered: item.qty_ordered,
        qtyReceived: item.qty_received,
        unitCost: Number(item.unit_cost),
      })),
      createdAt: order.created_at,
    };
  }
}
