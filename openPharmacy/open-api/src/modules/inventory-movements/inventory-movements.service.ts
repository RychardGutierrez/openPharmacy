import { Injectable } from '@nestjs/common';
import {
  Prisma,
  MovementType,
  InventoryAdjustment,
  AdjustmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import {
  InventoryMovementsRepository,
  CreateMovementInput,
} from './repositories/inventory-movements.repository';
import { AdjustmentResponseDto } from './dto/adjustment-response.dto';
import { MovementResponseDto } from './dto/movement-response.dto';
import {
  AdjustmentAlreadyProcessedException,
  AdjustmentSelfApprovalException,
  InsufficientLotStockException,
} from './exceptions/inventory-movements.exceptions';
import { AdjustmentDirection } from './dto/create-adjustment.dto';
import { mapAdjustment, mapMovement } from './mappers/inventory-movements.mapper';

export interface AdjustmentResult {
  adjustment: AdjustmentResponseDto;
  movement: MovementResponseDto;
}

/**
 * Business layer for inventory movements and manual adjustments.
 *
 * Responsibilities:
 * - Keep `inventory_movements` append-only.
 * - Apply manual adjustments only after admin approval.
 * - Reject adjustments that would drive stock negative before writing.
 * - Pair every stock mutation with an immutable movement record.
 */
@Injectable()
export class InventoryMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: InventoryMovementsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  /**
   * Low-level helper to write an immutable movement and, for decrease
   * movements, decrement stock. This is intentionally simple so callers such
   * as sales, returns, and purchase receiving can reuse it inside their own
   * transactions.
   */
  async writeMovementTx(
    tx: Prisma.TransactionClient,
    input: CreateMovementInput,
    signedQuantity: number,
  ): Promise<void> {
    await this.movements.createTx(tx, input);
    if (signedQuantity !== 0) {
      await this.movements.incrementStockTx(tx, input.lot_id, signedQuantity);
    }
  }

  /**
   * Create a pending manual adjustment. The stock does not change until an
   * admin approves the request.
   */
  async createAdjustment(
    requestedBy: string,
    dto: {
      productId: string;
      lotId: string;
      quantity: number;
      direction: AdjustmentDirection;
      reason: string;
    },
  ): Promise<InventoryAdjustment> {
    const movementType = MovementType.MANUAL_ADJUSTMENT;

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const created = await this.movements.createAdjustmentTx(tx, {
        product_id: dto.productId,
        lot_id: dto.lotId,
        requested_by: requestedBy,
        quantity: dto.quantity,
        direction: dto.direction,
        movementType,
        reason: dto.reason,
      });

      await this.audit.createInTx(tx, {
        userId: requestedBy,
        event: 'INVENTORY_ADJUSTMENT_REQUESTED',
        metadata: {
          adjustmentId: created.id,
          productId: created.product_id,
          lotId: created.lot_id,
          quantity: created.quantity,
          direction: created.direction,
          reason: created.reason,
        },
      });

      return created;
    });

    return mapAdjustment(adjustment);
  }

  /**
   * Approve a pending adjustment and apply it atomically:
   * - Lock the adjustment row.
   * - Lock the lot row.
   * - Validate enough stock for decreases.
   * - Update lot stock.
   * - Insert the immutable movement.
   * - Mark the adjustment as approved.
   * - Write an audit record.
   */
  async approveAdjustment(
    approverId: string,
    adjustmentId: string,
  ): Promise<AdjustmentResult> {
    const result = await this.prisma.$transaction(
      async (tx) => this.processApprovalTx(tx, approverId, adjustmentId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      adjustment: mapAdjustment(result.adjustment),
      movement: mapMovement(result.movement),
    };
  }

  private async processApprovalTx(
    tx: Prisma.TransactionClient,
    approverId: string,
    adjustmentId: string,
  ): Promise<AdjustmentResult> {
    const adjustment = await this.movements.lockPendingAdjustmentTx(
      tx,
      adjustmentId,
    );
    if (!adjustment) {
      throw new AdjustmentAlreadyProcessedException(adjustmentId, 'unknown');
    }

    if (adjustment.requested_by === approverId) {
      throw new AdjustmentSelfApprovalException(adjustmentId);
    }

    const lot = await this.movements.lockLotTx(tx, adjustment.lot_id);
    if (!lot) {
      throw new Error(`Lot ${adjustment.lot_id} not found`);
    }

    const isDecrease =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      adjustment.direction === AdjustmentDirection.DECREASE;
    const signedQuantity = isDecrease
      ? -adjustment.quantity
      : adjustment.quantity;

    if (isDecrease && lot.current_qty < adjustment.quantity) {
      throw new InsufficientLotStockException(
        lot.id,
        adjustment.quantity,
        lot.current_qty,
      );
    }

    const movement = await this.movements.createTx(tx, {
      product_id: adjustment.product_id,
      lot_id: adjustment.lot_id,
      user_id: adjustment.requested_by,
      movementType: adjustment.movementType,
      quantity: adjustment.quantity,
      reason: adjustment.reason,
      approved_by: approverId,
    });

    await this.movements.incrementStockTx(tx, lot.id, signedQuantity);

    const approved = await this.movements.approveAdjustmentTx(
      tx,
      adjustment.id,
      approverId,
    );

    await this.audit.createInTx(tx, {
      userId: approverId,
      event: 'INVENTORY_ADJUSTMENT_APPROVED',
      metadata: {
        adjustmentId: approved.id,
        movementId: movement.id,
        productId: approved.product_id,
        lotId: approved.lot_id,
        quantity: approved.quantity,
        direction: approved.direction,
        requestedBy: approved.requested_by,
      },
    });

    return { adjustment: approved, movement };
  }

  /**
   * Reject a pending adjustment without changing stock.
   */
  async rejectAdjustment(
    approverId: string,
    adjustmentId: string,
  ): Promise<InventoryAdjustment> {
    const result = await this.prisma.$transaction(
      async (tx) => this.processRejectionTx(tx, approverId, adjustmentId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return result;
  }

  private async processRejectionTx(
    tx: Prisma.TransactionClient,
    approverId: string,
    adjustmentId: string,
  ): Promise<InventoryAdjustment> {
    const adjustment = await this.movements.lockPendingAdjustmentTx(
      tx,
      adjustmentId,
    );
    if (!adjustment) {
      throw new AdjustmentAlreadyProcessedException(adjustmentId, 'unknown');
    }

    if (adjustment.requested_by === approverId) {
      throw new AdjustmentSelfApprovalException(adjustmentId);
    }

    const rejected = await this.movements.rejectAdjustmentTx(
      tx,
      adjustment.id,
      approverId,
    );

    await this.audit.createInTx(tx, {
      userId: approverId,
      event: 'INVENTORY_ADJUSTMENT_REJECTED',
      metadata: {
        adjustmentId: rejected.id,
        productId: rejected.product_id,
        lotId: rejected.lot_id,
        requestedBy: rejected.requested_by,
      },
    });

    return mapAdjustment(rejected);
  }

  /**
   * Paginated list of immutable inventory movements.
   */
  async findAll(query: {
    page: number;
    pageSize: number;
    productId?: string;
    lotId?: string;
    movementType?: MovementType;
    userId?: string;
    from?: string;
    to?: string;
  }): Promise<{
    data: Awaited<ReturnType<InventoryMovementsRepository['createTx']>>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.InventoryMovementWhereInput = {};
    if (query.productId) where.product_id = query.productId;
    if (query.lotId) where.lot_id = query.lotId;
    if (query.movementType) where.movementType = query.movementType;
    if (query.userId) where.user_id = query.userId;

    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) {
        where.created_at.gte = new Date(query.from);
      }
      if (query.to) {
        where.created_at.lte = new Date(query.to);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          product: { select: { id: true, commercial_name: true } },
          lot: { select: { id: true, lot_number: true } },
          user: { select: { id: true, full_name: true } },
          approver: { select: { id: true, full_name: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: data.map(mapMovement),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findOne(id: string): Promise<MovementResponseDto | null> {
    const movement = await this.prisma.inventoryMovement.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, commercial_name: true } },
        lot: { select: { id: true, lot_number: true } },
        user: { select: { id: true, full_name: true } },
        approver: { select: { id: true, full_name: true } },
      },
    });
    if (!movement) return null;
    return mapMovement(movement);
  }

  /**
   * Paginated list of adjustment requests.
   */
  async findAllAdjustments(query: {
    page: number;
    pageSize: number;
    productId?: string;
    lotId?: string;
    status?: string;
    requestedBy?: string;
  }): Promise<{
    data: AdjustmentResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.InventoryAdjustmentWhereInput = {};
    if (query.productId) where.product_id = query.productId;
    if (query.lotId) where.lot_id = query.lotId;

    if (query.status)
      where.status = query.status as unknown as AdjustmentStatus;
    if (query.requestedBy) where.requested_by = query.requestedBy;

    const [data, total] = await Promise.all([
      this.prisma.inventoryAdjustment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          product: { select: { id: true, commercial_name: true } },
          lot: { select: { id: true, lot_number: true } },
          requester: { select: { id: true, full_name: true } },
          approver: { select: { id: true, full_name: true } },
        },
      }),
      this.prisma.inventoryAdjustment.count({ where }),
    ]);

    return {
      data: data.map(mapAdjustment),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findAdjustmentById(id: string): Promise<AdjustmentResponseDto | null> {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, commercial_name: true } },
        lot: { select: { id: true, lot_number: true } },
        requester: { select: { id: true, full_name: true } },
        approver: { select: { id: true, full_name: true } },
      },
    });
    if (!adjustment) return null;
    return mapAdjustment(adjustment);
  }
}
