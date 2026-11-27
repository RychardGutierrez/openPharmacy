import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';

/** Point of sale with the branch number, as the SIAT calls need it. */
export interface SiatPointOfSaleRef {
  id: string;
  codigo_punto_venta: number;
  branch: { codigo_sucursal: number };
}

/**
 * The point of sale used for device-wide calls (clock, catalogs): casa matriz (branch 0) and
 * point of sale 0. Given an id, that point of sale is returned instead.
 */
export async function resolvePointOfSale(
  prisma: PrismaService,
  pointOfSaleId?: string,
): Promise<SiatPointOfSaleRef> {
  const pos = pointOfSaleId
    ? await prisma.siatPointOfSale.findUnique({
        where: { id: pointOfSaleId },
        include: { branch: true },
      })
    : await prisma.siatPointOfSale.findFirst({
        where: {
          codigo_punto_venta: 0,
          closed_at: null,
          branch: { codigo_sucursal: 0 },
        },
        include: { branch: true },
      });
  if (!pos) {
    throw new NotFoundException({
      code: 'SIAT_POINT_OF_SALE_NOT_FOUND',
      message: 'Point of sale not found',
    });
  }
  return pos;
}
