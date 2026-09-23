import { Injectable } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SuppliersQuery {
  page: number;
  pageSize: number;
  q?: string;
  active?: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Data-access layer for the `pharmacy.suppliers` table.
 *
 * Centralises supplier reads/writes for the supplier service and the
 * purchase-order flow. Suppliers are soft-deleted only: `deactivate()` flips
 * `active` to false and never issues a physical `delete`, so historical
 * `purchase_orders` rows always keep a valid supplier reference. There is no
 * `prisma.supplier.delete()` exposed here on purpose.
 */
@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.SupplierUncheckedCreateInput,
  ): Promise<Supplier> {
    return tx.supplier.create({ data });
  }

  /**
   * Find a supplier by id, including deactivated ones. Used by the detail
   * endpoint so admins can still inspect a supplier referenced by historical
   * purchase orders.
   */
  findById(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  /**
   * The active-supplier list that backs the purchase-order dropdown.
   */
  findAll(): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllPaginated(query: SuppliersQuery): Promise<Paginated<Supplier>> {
    const { page, pageSize, q, active } = query;
    const skip = (page - 1) * pageSize;
    const where: Prisma.SupplierWhereInput = {};
    if (active !== undefined) where.active = active;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { nit: { contains: q, mode: 'insensitive' } },
        { contact_person: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Uniqueness helpers. The `nit` column is globally unique (a NIT is a tax id
   * that cannot be reused even after deactivation), so these match on the bare
   * column without an active filter.
   */
  findByNit(nit: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { nit } });
  }

  findByNitExcept(nit: string, id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({
      where: { nit, NOT: { id } },
    });
  }

  /**
   * True when the supplier exists and is active. Used by the purchase-order
   * flow to reject orders against a missing or deactivated supplier before a
   * foreign-key error would surface as a 500.
   */
  async isActive(id: string): Promise<boolean> {
    const count = await this.prisma.supplier.count({
      where: { id, active: true },
    });
    return count > 0;
  }

  update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  updateTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.SupplierUpdateInput,
  ): Promise<Supplier> {
    return tx.supplier.update({ where: { id }, data });
  }

  /**
   * Soft-delete a supplier (set `active = false`). Idempotent: if the supplier
   * is already deactivated the current row is returned unchanged.
   */
  async deactivate(id: string): Promise<Supplier> {
    return this.deactivateTx(this.prisma, id);
  }

  async deactivateTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<Supplier> {
    await tx.supplier.updateMany({
      where: { id, active: true },
      data: { active: false },
    });
    return tx.supplier.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Restore a deactivated supplier (set `active = true`).
   */
  async activate(id: string): Promise<Supplier> {
    return this.activateTx(this.prisma, id);
  }

  async activateTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<Supplier> {
    await tx.supplier.updateMany({
      where: { id, active: false },
      data: { active: true },
    });
    return tx.supplier.findUniqueOrThrow({ where: { id } });
  }
}
