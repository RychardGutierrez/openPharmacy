import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { LotsRepository } from './repositories/lots.repository';
import { InsufficientStockException } from './exceptions/insufficient-stock.exception';

export interface DeductResult {
  success: boolean;
  lotsUsed: Array<{
    lotId: string;
    lotNumber: string;
    deductedQty: number;
  }>;
  remainingQty: number;
}

/**
 * FEFO stock deduction service.
 *
 * IMPORTANT: this service contains NO FEFO logic. The actual algorithm lives
 * entirely in the PostgreSQL function pharmacy.fn_deduct_stock_fefo so that
 * concurrent sales are serialized at the database level and cannot oversell.
 */
@Injectable()
export class FefoService {
  private readonly logger = new Logger(FefoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lots: LotsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  async deductStock(
    productId: string,
    quantity: number,
    userId?: string,
  ): Promise<DeductResult> {
    try {
      const rows = await this.prisma.$transaction(async (tx) => {
        const result = await this.lots.callFefo(tx, productId, quantity);

        await this.audit.createInTx(tx, {
          userId: userId ?? null,
          event: 'STOCK_DEDUCTED_FEFO',
          metadata: {
            productId,
            requestedQty: quantity,
            lotsUsed: result.map((r) => ({ ...r })),
          },
        });

        return result;
      });

      return {
        success: true,
        lotsUsed: rows.map((r) => ({
          lotId: r.lot_id,
          lotNumber: r.lot_number,
          deductedQty: r.deducted_qty,
        })),
        remainingQty: 0,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';

      if (
        message.includes('insufficient active non-expired stock') ||
        message.includes('quantity must be positive')
      ) {
        this.logger.warn(
          `FEFO deduction failed for product ${productId}: ${message}`,
        );
        throw new InsufficientStockException(productId, quantity);
      }

      throw error;
    }
  }
}
