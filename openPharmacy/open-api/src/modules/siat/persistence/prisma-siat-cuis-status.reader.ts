import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SiatStoredCuis {
  codigoSucursal: number;
  codigoPuntoVenta: number;
  /** Null when the point of sale has no active CUIS yet (requested in SIAT-05). */
  activeCuis: { validUntil: Date; requestedAt: Date } | null;
}

/**
 * Reads the CUIS we have stored for a point of sale. It does **not** call SIAT: requesting a
 * CUIS is a SIAT-05 operation. The CUIS code itself is not returned.
 */
@Injectable()
export class PrismaSiatCuisStatusReader {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    codigoSucursal: number,
    codigoPuntoVenta: number,
  ): Promise<SiatStoredCuis | null> {
    const pos = await this.prisma.siatPointOfSale.findFirst({
      where: {
        codigo_punto_venta: codigoPuntoVenta,
        branch: { codigo_sucursal: codigoSucursal },
      },
      select: {
        cuis: {
          where: { active: true },
          select: { valid_until: true, requested_at: true },
          take: 1,
        },
      },
    });
    if (!pos) return null;
    const [cuis] = pos.cuis;
    return {
      codigoSucursal,
      codigoPuntoVenta,
      activeCuis: cuis
        ? { validUntil: cuis.valid_until, requestedAt: cuis.requested_at }
        : null,
    };
  }
}
