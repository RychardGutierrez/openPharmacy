import { Injectable } from '@nestjs/common';
import {
  Prisma,
  InventoryMovement,
  InventoryAdjustment,
  AdjustmentStatus,
  MovementType,
  Lot,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdjustmentDirection } from '../dto/create-adjustment.dto';

export interface CreateMovementInput {
  product_id: string;
  lot_id: string;
  user_id: string;
  movementType: MovementType;
  quantity: number;
  reason?: string | null;
  approved_by?: string | null;
}

export interface CreateAdjustmentInput {
  product_id: string;
  lot_id: string;
  requested_by: string;
  quantity: number;
  direction: AdjustmentDirection;
  movementType: MovementType;
  reason: string;
}

/**
 * Data-access layer for `pharmacy.inventory_movements` and
 * `pharmacy.inventory_adjustments`.
 *
 * Stock ledger entries are immutable: this repository exposes only insert
 * helpers. Lot stock mutations are also centralized here so every write can
 * be paired with its movement record inside a transaction.
 */
@Injectable()
export class InventoryMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTx(
    tx: Prisma.TransactionClient,
    data: CreateMovementInput,
  ): Promise<InventoryMovement> {
    return tx.inventoryMovement.create({
      data: {
        product_id: data.product_id,
        lot_id: data.lot_id,
        user_id: data.user_id,
        movementType: data.movementType,
        quantity: data.quantity,
        reason: data.reason ?? null,
        approved_by: data.approved_by ?? null,
      },
    });
  }

  createManyTx(
    tx: Prisma.TransactionClient,
    data: CreateMovementInput[],
  ): Promise<{ count: number }> {
    return tx.inventoryMovement.createMany({
      data: data.map((row) => ({
        product_id: row.product_id,
        lot_id: row.lot_id,
        user_id: row.user_id,
        movementType: row.movementType,
        quantity: row.quantity,
        reason: row.reason ?? null,
        approved_by: row.approved_by ?? null,
      })),
    });
  }

  /**
   * Increment a lot's `current_qty` by `quantity` inside the caller's
   * transaction. The repository locks the lot row first to keep concurrent
   * sales / returns / adjustments consistent.
   */
  async incrementStockTx(
    tx: Prisma.TransactionClient,
    lotId: string,
    quantity: number,
  ): Promise<Lot> {
    await tx.$queryRaw`
      SELECT id FROM pharmacy.lots WHERE id = ${lotId}::uuid FOR UPDATE
    `;
    return tx.lot.update({
      where: { id: lotId },
      data: { current_qty: { increment: quantity } },
    });
  }

  /**
   * Decrement a lot's `current_qty` by `quantity` inside the caller's
   * transaction. Relies on the database CHECK constraint to reject any
   * resulting negative stock; callers should still validate first for a
   * friendly error message.
   */
  async decrementStockTx(
    tx: Prisma.TransactionClient,
    lotId: string,
    quantity: number,
  ): Promise<Lot> {
    await tx.$queryRaw`
      SELECT id FROM pharmacy.lots WHERE id = ${lotId}::uuid FOR UPDATE
    `;
    return tx.lot.update({
      where: { id: lotId },
      data: { current_qty: { decrement: quantity } },
    });
  }

  /**
   * Lock and read a lot row so callers can validate resulting stock before
   * committing a decrement.
   */
  async lockLotTx(
    tx: Prisma.TransactionClient,
    lotId: string,
  ): Promise<Lot | null> {
    const rows = await tx.$queryRaw<Lot[]>`
      SELECT * FROM pharmacy.lots WHERE id = ${lotId}::uuid FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Inventory adjustments
  // ─────────────────────────────────────────────────────────────────────────

  createAdjustmentTx(
    tx: Prisma.TransactionClient,
    data: CreateAdjustmentInput,
  ): Promise<InventoryAdjustment> {
    return tx.inventoryAdjustment.create({
      data: {
        product_id: data.product_id,
        lot_id: data.lot_id,
        requested_by: data.requested_by,
        quantity: data.quantity,
        direction: data.direction,
        movementType: data.movementType,
        reason: data.reason,
        status: AdjustmentStatus.PENDING,
      },
    });
  }

  async findAdjustmentById(id: string): Promise<InventoryAdjustment | null> {
    return this.prisma.inventoryAdjustment.findUnique({ where: { id } });
  }

  async findAdjustmentByIdTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<InventoryAdjustment | null> {
    return tx.inventoryAdjustment.findUnique({ where: { id } });
  }

  /**
   * Lock an adjustment row and assert it is still pending. Returns the row
   * or `null` if not found; throws if already processed.
   */
  async lockPendingAdjustmentTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<InventoryAdjustment | null> {
    const adjustment = await tx.inventoryAdjustment.findUnique({
      where: { id },
    });
    if (!adjustment) return null;
    if (adjustment.status !== AdjustmentStatus.PENDING) {
      throw new Error(`Adjustment ${id} is already ${adjustment.status}`);
    }
    return adjustment;
  }

  approveAdjustmentTx(
    tx: Prisma.TransactionClient,
    id: string,
    approverId: string,
  ): Promise<InventoryAdjustment> {
    return tx.inventoryAdjustment.update({
      where: { id },
      data: {
        status: AdjustmentStatus.APPROVED,
        approved_by: approverId,
        approved_at: new Date(),
      },
    });
  }

  rejectAdjustmentTx(
    tx: Prisma.TransactionClient,
    id: string,
    approverId: string,
  ): Promise<InventoryAdjustment> {
    return tx.inventoryAdjustment.update({
      where: { id },
      data: {
        status: AdjustmentStatus.REJECTED,
        approved_by: approverId,
        approved_at: new Date(),
      },
    });
  }

  async countPendingByLot(
    tx: Prisma.TransactionClient,
    lotId: string,
  ): Promise<number> {
    return tx.inventoryAdjustment.count({
      where: { lot_id: lotId, status: AdjustmentStatus.PENDING },
    });
  }
}
