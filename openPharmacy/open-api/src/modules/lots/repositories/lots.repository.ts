import { Injectable } from '@nestjs/common';
import { Prisma, Lot, Product } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type LotWithProduct = Lot & { product: Product };

export interface FefoDeductionRow {
  lot_id: string;
  lot_number: string;
  deducted_qty: number;
}

export interface LotDependencies {
  inventoryMovements: number;
  saleItems: number;
  returnItems: number;
}

export interface LotsQuery {
  page: number;
  pageSize: number;
  productId?: string;
  includeVoided?: boolean;
  q?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Data-access layer for the pharmacy.lots table.
 *
 * Enforces the regulatory rule that lot history is never destroyed:
 * no delete() is exposed; mistakes are corrected via void or typo-only edits.
 */
@Injectable()
export class LotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.LotUncheckedCreateInput): Promise<Lot> {
    return this.prisma.lot.create({ data });
  }

  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.LotUncheckedCreateInput,
  ): Promise<Lot> {
    return tx.lot.create({ data });
  }

  findById(id: string): Promise<LotWithProduct | null> {
    return this.prisma.lot.findUnique({
      where: { id },
      include: { product: true },
    });
  }

  findByProductIdAndLotNumber(
    productId: string,
    lotNumber: string,
  ): Promise<Lot | null> {
    return this.prisma.lot.findUnique({
      where: {
        product_id_lot_number: { product_id: productId, lot_number: lotNumber },
      },
    });
  }

  findByProductId(productId: string, includeVoided = false): Promise<Lot[]> {
    return this.prisma.lot.findMany({
      where: {
        product_id: productId,
        ...(includeVoided ? {} : { voided_at: null }),
      },
      orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
    });
  }

  findByLotNumber(lotNumber: string): Promise<LotWithProduct | null> {
    return this.prisma.lot.findFirst({
      where: { lot_number: lotNumber },
      include: { product: true },
    });
  }

  findAllActiveLots(): Promise<LotWithProduct[]> {
    return this.prisma.lot.findMany({
      where: { voided_at: null },
      include: { product: true },
      orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
    });
  }

  async findAllPaginated(query: LotsQuery): Promise<Paginated<LotWithProduct>> {
    const { page, pageSize, productId, includeVoided, q } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.LotWhereInput = {};

    if (!includeVoided) {
      where.voided_at = null;
    }

    if (productId) {
      where.product_id = productId;
    }

    if (q) {
      where.lot_number = { contains: q, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.lot.findMany({
        where,
        include: { product: true },
        orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
        skip,
        take: pageSize,
      }) as Promise<LotWithProduct[]>,
      this.prisma.lot.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async countDependencies(lotId: string): Promise<LotDependencies> {
    const [inventoryMovements, saleItems, returnItems] = await Promise.all([
      this.prisma.inventoryMovement.count({ where: { lot_id: lotId } }),
      this.prisma.saleItem.count({ where: { lot_id: lotId } }),
      this.prisma.returnItem.count({ where: { lot_id: lotId } }),
    ]);

    return { inventoryMovements, saleItems, returnItems };
  }

  update(id: string, data: Prisma.LotUncheckedUpdateInput): Promise<Lot> {
    return this.prisma.lot.update({ where: { id }, data });
  }

  updateTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.LotUncheckedUpdateInput,
  ): Promise<Lot> {
    return tx.lot.update({ where: { id }, data });
  }

  async voidTx(
    tx: Prisma.TransactionClient,
    id: string,
    voidedBy: string,
    reason: string,
  ): Promise<Lot> {
    const result = await tx.lot.updateMany({
      where: { id, voided_at: null },
      data: {
        voided_at: new Date(),
        voided_by: voidedBy,
        void_reason: reason,
      },
    });

    if (result.count === 0) {
      return tx.lot.findUniqueOrThrow({ where: { id } });
    }

    return tx.lot.findUniqueOrThrow({ where: { id } });
  }

  async callFefo(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ): Promise<FefoDeductionRow[]> {
    return tx.$queryRaw<FefoDeductionRow[]>`
      SELECT lot_id, lot_number, deducted_qty
      FROM pharmacy.fn_deduct_stock_fefo(${productId}::uuid, ${quantity})
    `;
  }
}
