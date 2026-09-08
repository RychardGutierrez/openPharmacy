import { Injectable } from '@nestjs/common';
import { Prisma, InventoryMovement, Lot } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Data-access layer for `pharmacy.inventory_movements` and stock helpers
 * used by the returns / cancellations flows.
 *
 * The current placeholder `InventoryMovementsService` only exposes CRUD
 * stubs, so this repository centralises the transactional writes needed
 * by PMS-010.
 */
@Injectable()
export class InventoryMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.InventoryMovementUncheckedCreateInput,
  ): Promise<InventoryMovement> {
    return tx.inventoryMovement.create({ data });
  }

  async createManyTx(
    tx: Prisma.TransactionClient,
    data: Prisma.InventoryMovementUncheckedCreateInput[],
  ): Promise<{ count: number }> {
    return tx.inventoryMovement.createMany({ data });
  }

  /**
   * Increment a lot's `current_qty` by `quantity` inside the caller's
   * transaction. The repository locks the lot row first to keep concurrent
   * sales / returns consistent.
   */
  async restoreStockTx(
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
}
