import { Injectable } from '@nestjs/common';
import { Prisma, Product, ProductCategory } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ProductsQuery {
  page: number;
  pageSize: number;
  category?: ProductCategory;
  active?: boolean;
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
 * Data-access layer for the `pharmacy.products` table.
 *
 * This is the single source of truth for product persistence. All access to the
 * `products` table from `ProductsService` goes through this repository. It
 * enforces the soft-delete policy: no `prisma.product.delete()` is exposed here;
 * deactivation is always done via `softDelete()`.
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product.
   */
  create(data: Prisma.ProductUncheckedCreateInput): Promise<Product> {
    return this.prisma.product.create({ data });
  }

  /**
   * Transaction-aware version of create.
   */
  createTx(
    tx: Prisma.TransactionClient,
    data: Prisma.ProductUncheckedCreateInput,
  ): Promise<Product> {
    return tx.product.create({ data });
  }

  /**
   * Find a product by ID, including soft-deleted products.
   */
  findByIdIncludingDeleted(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { id } });
  }

  /**
   * Find an active product by ID.
   */
  findById(id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { id, deleted_at: null },
    });
  }

  /**
   * Find an active product by barcode.
   */
  findByBarcode(barcode: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { barcode },
    });
  }

  /**
   * Find an active product by barcode, excluding the given ID.
   * Used to enforce uniqueness during updates.
   */
  findByBarcodeExcept(barcode: string, id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { barcode, NOT: { id } },
    });
  }

  /**
   * Paginated, filterable product list. Always excludes soft-deleted products
   * unless `active` is explicitly set to false.
   */
  async findAllPaginated(query: ProductsQuery): Promise<Paginated<Product>> {
    const { page, pageSize, category, active, q } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductWhereInput = {};

    if (active === false) {
      where.deleted_at = { not: null };
    } else if (active !== undefined) {
      where.deleted_at = null;
    }

    if (category) {
      where.category = category;
    }

    if (q) {
      where.OR = [
        { dci_name: { contains: q, mode: 'insensitive' } },
        { commercial_name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
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
   * Search active products by name for autocomplete.
   */
  async searchAutocomplete(q: string, limit: number): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        deleted_at: null,
        OR: [
          { dci_name: { contains: q, mode: 'insensitive' } },
          { commercial_name: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { commercial_name: 'asc' },
      take: limit,
    });
  }

  /**
   * Update any editable product fields.
   */
  update(
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  /**
   * Transaction-aware version of update.
   */
  updateTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<Product> {
    return tx.product.update({ where: { id }, data });
  }

  /**
   * Soft-delete a product and set active=false.
   */
  async softDelete(id: string, now: Date): Promise<Product> {
    return this.softDeleteTx(this.prisma, id, now);
  }

  /**
   * Transaction-aware version of softDelete.
   */
  async softDeleteTx(
    tx: Prisma.TransactionClient,
    id: string,
    now: Date,
  ): Promise<Product> {
    const result = await tx.product.updateMany({
      where: { id, deleted_at: null },
      data: {
        deleted_at: now,
        active: false,
      },
    });

    if (result.count === 0) {
      return tx.product.findUniqueOrThrow({ where: { id } });
    }

    return tx.product.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Reactivate a soft-deleted product.
   */
  async restore(id: string): Promise<Product> {
    return this.restoreTx(this.prisma, id);
  }

  /**
   * Transaction-aware version of restore.
   */
  async restoreTx(tx: Prisma.TransactionClient, id: string): Promise<Product> {
    const result = await tx.product.updateMany({
      where: { id, deleted_at: { not: null } },
      data: {
        deleted_at: null,
        active: true,
      },
    });

    if (result.count === 0) {
      return tx.product.findUniqueOrThrow({ where: { id } });
    }

    return tx.product.findUniqueOrThrow({ where: { id } });
  }
}
