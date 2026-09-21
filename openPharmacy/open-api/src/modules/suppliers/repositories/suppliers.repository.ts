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
 * purchase-order flow (which only needs a list and a "last cost" lookup).
 */
@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  findById(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

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

  update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  remove(id: string): Promise<Supplier> {
    return this.prisma.supplier.delete({ where: { id } });
  }
}
