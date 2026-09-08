import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ProductCategory, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { CreateReturnDto } from './dto/create-return.dto';
import {
  CancelSaleDto,
  ReturnResponseDto,
  ReturnResponseItemDto,
} from './dto/return-response.dto';
import { ReturnsRepository } from './repositories/returns.repository';
import { InventoryMovementsRepository } from '../inventory-movements/repositories/inventory-movements.repository';
import { SalesRepository } from '../sales/repositories/sales.repository';
import {
  ControlledProductReturnException,
  ReturnItemsMissingException,
  ReturnQuantityExceededException,
  ReturnSaleItemMismatchException,
  ReturnSaleNotEligibleException,
  SaleAlreadyCancelledException,
  SaleHasReturnsException,
} from './exceptions';

/**
 * Categories that are forbidden from returns and cancellations. The check is
 * performed at the API layer regardless of UI state, per pharmacy
 * regulations. `PRESCRIPTION_ONLY` is intentionally NOT in this set.
 */
const CONTROLLED_CATEGORIES = new Set<ProductCategory>([
  ProductCategory.PSYCHOTROPIC,
  ProductCategory.NARCOTIC,
]);

/**
 * Aggregated stock that must be restored to a single lot. Built either from
 * a partial set of sale items (a customer return) or from every line in the
 * sale (an operational cancellation).
 */
interface LotRestoration {
  productId: string;
  lotId: string;
  quantity: number;
}

type Tx = Prisma.TransactionClient;

/**
 * Sales with their line items + the product category. Mirrors what
 * `SalesRepository.findByIdWithItemsTx` returns and is used throughout the
 * service so we never rely on raw `any` shapes.
 */
type SaleWithItems = Awaited<
  ReturnType<SalesRepository['findByIdWithItemsTx']>
>;

/**
 * Returns and sale-cancellation business logic.
 *
 * Both operations share the same inventory-restoration primitive: lock the
 * affected rows, write movement records and audit events inside one
 * transaction, and commit atomically. Each operation is split into small
 * named steps so the high-level flow stays readable and each step can be
 * unit-tested in isolation if needed.
 */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly returns: ReturnsRepository,
    private readonly movements: InventoryMovementsRepository,
    private readonly sales: SalesRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Customer return
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process a customer return end-to-end.
   *
   * High-level flow:
   *   1. Open a SERIALIZABLE transaction so concurrent returns against the
   *      same sale cannot overshoot the refundable quantity.
   *   2. Lock the sale and the requested `sale_items` rows.
   *   3. Validate eligibility: sale status, item ownership, controlled
   *      substances, and cumulative refundable quantity.
   *   4. Persist the `return` + `return_items`, restore stock per lot,
   *      write one `RETURN` movement per affected lot, optionally flip the
   *      sale to `REFUNDED`, and emit one `RETURN_COMPLETED` audit row.
   *   5. After commit, hydrate `lotNumber` for the response payload.
   */
  async create(
    userId: string,
    dto: CreateReturnDto,
  ): Promise<ReturnResponseDto> {
    const response = await this.prisma.$transaction(
      async (tx) => this.processReturnTx(tx, userId, dto),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.hydrateLotNumbers(response);
  }

  private async processReturnTx(
    tx: Tx,
    userId: string,
    dto: CreateReturnDto,
  ): Promise<ReturnResponseDto> {
    await this.sales.lockByIdTx(tx, dto.saleId);
    const sale = await this.loadEligibleSale(tx, dto.saleId);

    const requestedByLine = this.aggregateRequestedQuantities(dto.items);
    const saleItemIds = [...requestedByLine.keys()];

    const lockedSaleItems = await this.lockRequestedSaleItems(
      tx,
      saleItemIds,
      dto.saleId,
    );

    const productMap = await this.loadProductsForSaleItems(tx, lockedSaleItems);

    await this.assertRefundableQuantities(
      tx,
      lockedSaleItems,
      requestedByLine,
      productMap,
    );

    const restockPlan = this.buildRestockPlan(lockedSaleItems, requestedByLine);

    const returnRecord = await this.persistReturn(
      tx,
      dto,
      userId,
      restockPlan,
      lockedSaleItems,
      requestedByLine,
    );

    await this.maybeMarkSaleRefunded(tx, sale, dto);

    await this.audit.createInTx(tx, {
      userId,
      event: 'RETURN_COMPLETED',
      metadata: {
        returnId: returnRecord.id,
        saleId: dto.saleId,
        returnType: dto.returnType,
        items: returnRecord.items.map((item) => ({
          saleItemId: item.saleItemId,
          lotId: item.lotId,
          quantity: item.quantity,
        })),
      },
    });

    return returnRecord;
  }

  /** Load the sale and assert it is in `COMPLETED` status. */
  private async loadEligibleSale(
    tx: Tx,
    saleId: string,
  ): Promise<NonNullable<SaleWithItems>> {
    const sale = await this.sales.findByIdWithItemsTx(tx, saleId);
    if (!sale) {
      throw new NotFoundException(`Sale ${saleId} not found`);
    }
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new ReturnSaleNotEligibleException(saleId, sale.status);
    }
    return sale;
  }

  /**
   * Sum the requested quantities per `saleItemId` so a client cannot smuggle
   * extra units by repeating the same line. Returns the map of unique
   * `saleItemId → total quantity`.
   */
  private aggregateRequestedQuantities(
    items: CreateReturnDto['items'],
  ): Map<string, number> {
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(
        item.saleItemId,
        (totals.get(item.saleItemId) ?? 0) + item.quantity,
      );
    }
    return totals;
  }

  /**
   * Lock the requested `sale_items` rows and validate two things at once:
   *   - every requested id exists,
   *   - every requested id actually belongs to the supplied `saleId`.
   * A mismatched line is rejected with `400 RETURN_SALE_ITEM_MISMATCH`
   * before any state change.
   */
  private async lockRequestedSaleItems(
    tx: Tx,
    saleItemIds: string[],
    saleId: string,
  ): Promise<NonNullable<SaleWithItems>['saleItems']> {
    if (saleItemIds.length === 0) {
      throw new ReturnItemsMissingException(saleItemIds);
    }

    const locked = await this.returns.lockSaleItemsTx(tx, saleItemIds);
    if (locked.length === 0) {
      throw new ReturnItemsMissingException(saleItemIds);
    }

    const foundIds = new Set(locked.map((row) => row.id));
    const missing = saleItemIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ReturnItemsMissingException(missing);
    }

    const wrongSale = locked.find((row) => row.sale_id !== saleId);
    if (wrongSale) {
      throw new ReturnSaleItemMismatchException(wrongSale.id, saleId);
    }

    return locked as NonNullable<SaleWithItems>['saleItems'];
  }

  /** Bulk-load the products referenced by the locked sale items. */
  private async loadProductsForSaleItems(
    tx: Tx,
    saleItems: NonNullable<SaleWithItems>['saleItems'],
  ): Promise<
    Map<
      string,
      { id: string; category: ProductCategory; commercial_name: string }
    >
  > {
    const productIds = [...new Set(saleItems.map((row) => row.product_id))];
    if (productIds.length === 0) return new Map();

    const rows = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: true, commercial_name: true },
    });
    return new Map(rows.map((p) => [p.id, p]));
  }

  /**
   * Enforce the business rules per requested line:
   *   - cumulative returned quantity + this request ≤ original sold quantity
   *   - the product is not PSYCHOTROPIC / NARCOTIC
   *
   * Throws `ReturnQuantityExceededException` or
   * `ControlledProductReturnException` on the first offending line.
   */
  private async assertRefundableQuantities(
    tx: Tx,
    saleItems: NonNullable<SaleWithItems>['saleItems'],
    requestedByLine: Map<string, number>,
    productMap: Map<
      string,
      { id: string; category: ProductCategory; commercial_name: string }
    >,
  ): Promise<void> {
    const saleItemIds = [...requestedByLine.keys()];
    const alreadyReturned = await this.returns.sumBySaleItems(tx, saleItemIds);

    for (const saleItem of saleItems) {
      const totalRequested = requestedByLine.get(saleItem.id) ?? 0;
      if (totalRequested <= 0) continue;

      const previouslyReturned = alreadyReturned.get(saleItem.id) ?? 0;
      const available = saleItem.quantity - previouslyReturned;
      if (totalRequested > available) {
        throw new ReturnQuantityExceededException(
          saleItem.id,
          totalRequested,
          previouslyReturned,
          available,
        );
      }

      const product = productMap.get(saleItem.product_id);
      if (!product) {
        throw new NotFoundException(
          `Product ${saleItem.product_id} not found for sale item ${saleItem.id}`,
        );
      }
      if (CONTROLLED_CATEGORIES.has(product.category)) {
        throw new ControlledProductReturnException(
          product.id,
          product.commercial_name,
        );
      }
    }
  }

  /**
   * Group the requested refundable quantities by lot so each affected lot
   * receives a single `inventory_movement` of type `RETURN` plus a single
   * `current_qty` increment.
   */
  private buildRestockPlan(
    saleItems: NonNullable<SaleWithItems>['saleItems'],
    requestedByLine: Map<string, number>,
  ): LotRestoration[] {
    const grouped = new Map<string, LotRestoration>();
    for (const saleItem of saleItems) {
      const totalRequested = requestedByLine.get(saleItem.id) ?? 0;
      if (totalRequested <= 0) continue;

      const existing = grouped.get(saleItem.lot_id);
      if (existing) {
        existing.quantity += totalRequested;
      } else {
        grouped.set(saleItem.lot_id, {
          productId: saleItem.product_id,
          lotId: saleItem.lot_id,
          quantity: totalRequested,
        });
      }
    }
    return [...grouped.values()];
  }

  /**
   * Persist the `return` row, one `return_item` per requested line, the
   * stock restoration per lot, and one `RETURN` movement per lot. Returns a
   * `ReturnResponseDto` shell with placeholder `lotNumber`s; the caller is
   * responsible for hydrating them after commit.
   */
  private async persistReturn(
    tx: Tx,
    dto: CreateReturnDto,
    userId: string,
    restockPlan: LotRestoration[],
    saleItems: NonNullable<SaleWithItems>['saleItems'],
    requestedByLine: Map<string, number>,
  ): Promise<ReturnResponseDto> {
    const returnRecord = await this.returns.createTx(tx, {
      sale_id: dto.saleId,
      user_id: userId,
      reason: dto.reason,
      returnType: dto.returnType,
    });

    const responseItems: ReturnResponseItemDto[] = [];
    for (const saleItem of saleItems) {
      const totalRequested = requestedByLine.get(saleItem.id) ?? 0;
      if (totalRequested <= 0) continue;

      const created = await this.returns.createItemTx(tx, {
        return_id: returnRecord.id,
        sale_item_id: saleItem.id,
        lot_id: saleItem.lot_id,
        quantity: totalRequested,
      });

      responseItems.push({
        id: created.id,
        saleItemId: saleItem.id,
        productId: saleItem.product_id,
        lotId: saleItem.lot_id,
        quantity: totalRequested,
        lotNumber: '',
      });
    }

    for (const plan of restockPlan) {
      await this.movements.restoreStockTx(tx, plan.lotId, plan.quantity);
      await this.movements.createTx(tx, {
        product_id: plan.productId,
        lot_id: plan.lotId,
        user_id: userId,
        movementType: 'RETURN',
        quantity: plan.quantity,
        reason: `RETURN-${returnRecord.id}`,
      });
    }

    return {
      id: returnRecord.id,
      saleId: dto.saleId,
      userId,
      reason: dto.reason,
      returnType: returnRecord.returnType,
      createdAt: returnRecord.created_at,
      items: responseItems,
    };
  }

  /**
   * Flip the sale status to `REFUNDED` only when the request was declared as
   * `FULL` AND covers every unit originally sold. Partial returns leave the
   * sale as `COMPLETED`.
   */
  private async maybeMarkSaleRefunded(
    tx: Tx,
    sale: NonNullable<SaleWithItems>,
    dto: CreateReturnDto,
  ): Promise<void> {
    if (dto.returnType !== 'FULL') return;

    const totalSold = sale.saleItems.reduce(
      (sum, row) => sum + row.quantity,
      0,
    );
    const totalReturned = dto.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    if (totalReturned < totalSold) return;

    await this.sales.updateStatusTx(tx, dto.saleId, SaleStatus.REFUNDED);
  }

  /** Resolve human-readable lot numbers outside the transaction. */
  private async hydrateLotNumbers(
    response: ReturnResponseDto,
  ): Promise<ReturnResponseDto> {
    if (response.items.length === 0) return response;

    const lots = await this.prisma.lot.findMany({
      where: { id: { in: response.items.map((item) => item.lotId) } },
      select: { id: true, lot_number: true },
    });
    const lotMap = new Map(lots.map((l) => [l.id, l.lot_number]));

    return {
      ...response,
      items: response.items.map((item) => ({
        ...item,
        lotNumber: lotMap.get(item.lotId) ?? '',
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sale cancellation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cancel a completed sale as an operational correction (not a customer
   * return). Restores every line item to its original lot and flips the
   * sale status to `CANCELLED`.
   *
   * Refuses to proceed when the sale already has a return record so we
   * never emit duplicate reversal movements.
   */
  async cancel(
    userId: string,
    saleId: string,
    dto: CancelSaleDto,
  ): Promise<ReturnResponseDto> {
    const response = await this.prisma.$transaction(
      async (tx) => this.processCancellationTx(tx, userId, saleId, dto),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.hydrateLotNumbers(response);
  }

  private async processCancellationTx(
    tx: Tx,
    userId: string,
    saleId: string,
    dto: CancelSaleDto,
  ): Promise<ReturnResponseDto> {
    await this.sales.lockByIdTx(tx, saleId);
    const sale = await this.loadCancellableSale(tx, saleId);
    await this.assertNoReturnsExist(tx, saleId);
    this.assertNoControlledLines(sale);

    const saleItemIds = sale.saleItems.map((row) => row.id);
    await this.returns.lockSaleItemsTx(tx, saleItemIds);

    const restockPlan = this.buildRestockPlan(
      sale.saleItems,
      new Map(sale.saleItems.map((row) => [row.id, row.quantity])),
    );

    const responseItems = await this.restoreLotsAndWriteCancellationMovements(
      tx,
      userId,
      saleId,
      restockPlan,
    );

    const updated = await this.sales.updateStatusTx(
      tx,
      saleId,
      SaleStatus.CANCELLED,
    );

    await this.audit.createInTx(tx, {
      userId,
      event: 'SALE_CANCELLED',
      metadata: {
        saleId,
        reason: dto.reason,
        movementCount: restockPlan.length,
      },
    });

    return {
      id: `cancel-${saleId}`,
      saleId,
      userId,
      reason: dto.reason,
      returnType: 'FULL',
      createdAt: updated.created_at,
      items: responseItems,
    };
  }

  /** Load the sale and reject anything other than `COMPLETED`. */
  private async loadCancellableSale(
    tx: Tx,
    saleId: string,
  ): Promise<NonNullable<SaleWithItems>> {
    const sale = await this.sales.findByIdWithItemsTx(tx, saleId);
    if (!sale) {
      throw new NotFoundException(`Sale ${saleId} not found`);
    }
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new SaleAlreadyCancelledException(saleId, sale.status);
    }
    return sale;
  }

  /**
   * A sale with at least one `return` row is considered partially refunded
   * and must be resolved through the returns flow before it can be
   * cancelled — otherwise we would emit contradictory reversal movements.
   */
  private async assertNoReturnsExist(tx: Tx, saleId: string): Promise<void> {
    const count = await this.sales.countReturnsBySaleTx(tx, saleId);
    if (count > 0) {
      throw new SaleHasReturnsException(saleId);
    }
  }

  /**
   * Controlled-substance lines are not eligible for operational
   * cancellation. The check happens before any state change.
   */
  private assertNoControlledLines(sale: NonNullable<SaleWithItems>): void {
    const controlled = sale.saleItems.find((row) =>
      CONTROLLED_CATEGORIES.has(row.product.category),
    );
    if (controlled) {
      throw new ControlledProductReturnException(
        controlled.product.id,
        controlled.product.commercial_name,
      );
    }
  }

  /**
   * Restore `lots.current_qty` and write one `CANCELLATION` movement per
   * affected lot. Builds the response items in the same loop to avoid a
   * second pass.
   */
  private async restoreLotsAndWriteCancellationMovements(
    tx: Tx,
    userId: string,
    saleId: string,
    restockPlan: LotRestoration[],
  ): Promise<ReturnResponseItemDto[]> {
    const responseItems: ReturnResponseItemDto[] = [];
    for (const plan of restockPlan) {
      await this.movements.restoreStockTx(tx, plan.lotId, plan.quantity);
      await this.movements.createTx(tx, {
        product_id: plan.productId,
        lot_id: plan.lotId,
        user_id: userId,
        movementType: 'CANCELLATION',
        quantity: plan.quantity,
        reason: `CANCEL-${saleId}`,
      });
      responseItems.push({
        id: `cancel-${plan.lotId}`,
        saleItemId: '',
        productId: plan.productId,
        lotId: plan.lotId,
        quantity: plan.quantity,
        lotNumber: '',
      });
    }
    return responseItems;
  }
}
