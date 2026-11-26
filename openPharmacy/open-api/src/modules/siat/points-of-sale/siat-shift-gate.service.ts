import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { cuisUsable, type SiatCuisState } from '../codes/siat-cuis-policy';
import { SiatCodesService } from '../codes/siat-codes.service';

/**
 * Decides which SIAT point of sale a new shift uses (SIAT-05). The only SIAT entry point the
 * shifts module needs, so it does not depend on SIAT internals.
 *
 * - A given `pointOfSaleId` must be an active, open point of sale of an active branch.
 * - Without one, the single active point of sale is used. With several, the cashier must choose
 *   while SIAT is enabled; with SIAT disabled the shift opens without a point of sale.
 * - While `SIAT_ENABLED` is true the point of sale needs a usable CUIS, obtained here if missing.
 *   A stored CUIS that is still valid is enough when SIAT is unreachable.
 */
@Injectable()
export class SiatShiftGate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: SiatCodesService,
  ) {}

  async resolvePointOfSale(
    pointOfSaleId: string | undefined,
    userId: string,
  ): Promise<string | null> {
    const enabled = await this.codes.siatEnabled();
    const selectable = {
      active: true,
      closed_at: null,
      branch: { active: true },
    };

    let posId: string | null = null;
    if (pointOfSaleId) {
      const pos = await this.prisma.siatPointOfSale.findFirst({
        where: { id: pointOfSaleId, ...selectable },
        select: { id: true },
      });
      if (!pos)
        throw new NotFoundException('Point of sale not found or inactive');
      posId = pos.id;
    } else {
      const candidates = await this.prisma.siatPointOfSale.findMany({
        where: selectable,
        select: { id: true },
        take: 2,
      });
      if (candidates.length === 1) posId = candidates[0].id;
      else if (enabled) {
        throw candidates.length === 0
          ? new ConflictException({
              code: 'SIAT_POS_NOT_READY',
              message: 'No active SIAT point of sale is configured',
            })
          : new BadRequestException({
              code: 'SIAT_POS_REQUIRED',
              message: 'Choose the point of sale for this shift',
            });
      }
    }

    if (!enabled || !posId) return posId;

    let state: SiatCuisState;
    try {
      state = (await this.codes.ensureCuis(posId, { userId })).state;
    } catch {
      state = 'missing' as const;
    }
    if (!cuisUsable(state)) {
      throw new ConflictException({
        code: 'SIAT_POS_NOT_READY',
        message:
          'The point of sale has no valid CUIS and SIAT could not issue one. Try again or contact the administrator.',
      });
    }
    return posId;
  }
}
