import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Prisma, Product, ProductCategory } from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { SiatCatalogsService } from '../siat/catalogs/siat-catalogs.service';
import { RequestMetadata } from '../users/users.service';
import {
  IncompleteSinCodesException,
  InvalidSinCodesException,
  type SinCodeFailure,
} from './exceptions/invalid-sin-codes.exception';
import { ProductNotHomologatedException } from '../sales/exceptions/product-not-homologated.exception';

/** The three SIN codes of a product, all present (SIAT-08). */
export interface SinCodes {
  activityCode: string;
  productCode: string;
  unitCode: string;
}

/** Shape shared by the create, update and bulk import DTOs. */
export interface SinCodeInput {
  sinActivityCode?: string | null;
  sinProductCode?: string | null;
  sinUnitCode?: string | null;
}

/** The product fields the homologation rules read. */
export type HomologationProduct = Pick<
  Product,
  | 'id'
  | 'commercial_name'
  | 'category'
  | 'sin_activity_code'
  | 'sin_product_code'
  | 'sin_unit_code'
>;

/** Stored codes that are not active in the synced SIN catalogs (SIAT-08). */
export interface InvalidSinReport {
  catalogSynced: boolean;
  products: (SinCodes & {
    id: string;
    commercialName: string;
    category: ProductCategory;
    invalidFields: SinCodeFailure['field'][];
  })[];
  defaults: (SinCodes & {
    category: ProductCategory;
    invalidFields: SinCodeFailure['field'][];
  })[];
}

const SIN_FIELDS: SinCodeFailure['field'][] = [
  'sinActivityCode',
  'sinProductCode',
  'sinUnitCode',
];

/**
 * SIN homologation of products (SIAT-08): resolving and validating the three codes, the sale
 * guard, the pending count, and category defaults. Product CRUD stays in `ProductsService`.
 */
@Injectable()
export class ProductSinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogRepository,
    private readonly config: ConfigService,
    private readonly catalogs: SiatCatalogsService,
  ) {}

  /**
   * Returns the complete codes, or null when none is set. Throws when only some are set, because
   * a product needs all three or none. `undefined` means "not sent", so callers merge partial
   * updates with the stored codes before calling this.
   */
  static resolveComplete(input: SinCodeInput): SinCodes | null {
    const values: Record<SinCodeFailure['field'], string | null | undefined> = {
      sinActivityCode: input.sinActivityCode,
      sinProductCode: input.sinProductCode,
      sinUnitCode: input.sinUnitCode,
    };
    const present = SIN_FIELDS.filter((field) => !!values[field]);
    if (present.length === 0) return null;

    const missing = SIN_FIELDS.filter((field) => !values[field]);
    if (missing.length > 0) throw new IncompleteSinCodesException(missing);

    return {
      activityCode: values.sinActivityCode as string,
      productCode: values.sinProductCode as string,
      unitCode: values.sinUnitCode as string,
    };
  }

  /**
   * Checks the codes against the synced SIN catalogs. Skipped while the activities catalog has
   * never been synchronized, so the format check in the DTO is the only rule until then.
   */
  async validateCodes(codes: SinCodes): Promise<void> {
    if (!(await this.catalogs.hasActiveCodes('activities'))) return;
    const failures = await this.catalogs.validateSinCodes(codes);
    if (failures.length > 0) throw new InvalidSinCodesException(failures);
  }

  /** The codes a product carries itself, complete or null. */
  static ownCodes(product: HomologationProduct): SinCodes | null {
    if (
      !product.sin_activity_code ||
      !product.sin_product_code ||
      !product.sin_unit_code
    ) {
      return null;
    }
    return {
      activityCode: product.sin_activity_code,
      productCode: product.sin_product_code,
      unitCode: product.sin_unit_code,
    };
  }

  async isSiatEnabled(): Promise<boolean> {
    const stored = await this.config.getStoredValues(['SIAT_ENABLED']);
    return stored.SIAT_ENABLED === true;
  }

  /**
   * The codes each product invoices with: its own complete codes, otherwise its category default.
   * Products with neither are left out of the map. This is the single source for the sale guard
   * and for invoice lines (SIAT-11). Pass the sale's `tx` to read defaults inside it.
   */
  async resolveEffective(
    products: HomologationProduct[],
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Map<string, SinCodes>> {
    const defaults = await tx.productSinDefault.findMany();
    const byCategory = new Map<ProductCategory, SinCodes>(
      defaults.map((row) => [
        row.category,
        {
          activityCode: row.sin_activity_code,
          productCode: row.sin_product_code,
          unitCode: row.sin_unit_code,
        },
      ]),
    );

    const resolved = new Map<string, SinCodes>();
    for (const product of products) {
      const codes =
        ProductSinService.ownCodes(product) ?? byCategory.get(product.category);
      if (codes) resolved.set(product.id, codes);
    }
    return resolved;
  }

  /**
   * Sale guard (SIAT-08). With SIAT enabled, every product must carry its own codes or belong to a
   * category with a default. `tx` keeps the check inside the sale's transaction.
   */
  async assertSalable(
    products: HomologationProduct[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!(await this.isSiatEnabled())) return;

    const resolved = await this.resolveEffective(products, tx);
    const blocked = products
      .filter((product) => !resolved.has(product.id))
      .map((product) => ({
        id: product.id,
        commercialName: product.commercial_name,
      }));
    if (blocked.length > 0) throw new ProductNotHomologatedException(blocked);
  }

  /**
   * Stored codes that are no longer active in the synced SIN catalogs: codes saved before the
   * first sync (when validation was skipped) and codes the SIN has since removed. Covers the
   * products' own codes and the category defaults. `catalogSynced` is false, with empty lists,
   * until the activities catalog has been synchronized.
   */
  async invalidCodes(): Promise<InvalidSinReport> {
    if (!(await this.catalogs.hasActiveCodes('activities'))) {
      return { catalogSynced: false, products: [], defaults: [] };
    }
    const [activities, sinProducts, units, products, defaults] =
      await Promise.all([
        this.catalogs.activeCodeSet('activities'),
        this.catalogs.activeCodeSet('products'),
        this.catalogs.activeCodeSet('units'),
        this.prisma.product.findMany({
          where: {
            active: true,
            deleted_at: null,
            sin_activity_code: { not: null },
            sin_product_code: { not: null },
            sin_unit_code: { not: null },
          },
          select: {
            id: true,
            commercial_name: true,
            category: true,
            sin_activity_code: true,
            sin_product_code: true,
            sin_unit_code: true,
          },
          orderBy: { commercial_name: 'asc' },
        }),
        this.prisma.productSinDefault.findMany({
          orderBy: { category: 'asc' },
        }),
      ]);

    const failingFields = (codes: SinCodes): SinCodeFailure['field'][] => {
      const fields: SinCodeFailure['field'][] = [];
      if (!activities.has(codes.activityCode)) fields.push('sinActivityCode');
      if (!sinProducts.has(`${codes.activityCode}:${codes.productCode}`))
        fields.push('sinProductCode');
      if (!units.has(codes.unitCode)) fields.push('sinUnitCode');
      return fields;
    };

    const invalidProducts: InvalidSinReport['products'] = [];
    for (const product of products) {
      const codes = ProductSinService.ownCodes(product);
      if (!codes) continue;
      const fields = failingFields(codes);
      if (fields.length > 0) {
        invalidProducts.push({
          id: product.id,
          commercialName: product.commercial_name,
          category: product.category,
          ...codes,
          invalidFields: fields,
        });
      }
    }

    const invalidDefaults: InvalidSinReport['defaults'] = [];
    for (const row of defaults) {
      const codes = {
        activityCode: row.sin_activity_code,
        productCode: row.sin_product_code,
        unitCode: row.sin_unit_code,
      };
      const fields = failingFields(codes);
      if (fields.length > 0) {
        invalidDefaults.push({
          category: row.category,
          ...codes,
          invalidFields: fields,
        });
      }
    }

    return {
      catalogSynced: true,
      products: invalidProducts,
      defaults: invalidDefaults,
    };
  }

  /** Active, non-deleted products that are not covered by their own codes or a category default. */
  async pendingWhere(): Promise<Prisma.ProductWhereInput> {
    const defaults = await this.prisma.productSinDefault.findMany({
      select: { category: true },
    });
    return {
      active: true,
      deleted_at: null,
      category: {
        notIn: defaults.map((row) => row.category),
      },
      OR: this.incompleteOr(),
    };
  }

  /**
   * Homologation progress over active products. `invalid` counts products whose own codes left
   * the SIN catalogs, and `invalidDefaults` the categories whose default did. Those products are
   * still counted as homologated, because they carry codes, but SIAT will reject their lines.
   */
  async summary(): Promise<{
    total: number;
    homologated: number;
    pending: number;
    invalid: number;
    invalidDefaults: number;
  }> {
    const base: Prisma.ProductWhereInput = { active: true, deleted_at: null };
    const [total, pending, invalid] = await Promise.all([
      this.prisma.product.count({ where: base }),
      this.prisma.product.count({ where: await this.pendingWhere() }),
      this.invalidCodes(),
    ]);
    return {
      total,
      homologated: total - pending,
      pending,
      invalid: invalid.products.length,
      invalidDefaults: invalid.defaults.length,
    };
  }

  listDefaults() {
    return this.prisma.productSinDefault.findMany({
      orderBy: { category: 'asc' },
    });
  }

  /** Sets the default codes of a category. Validated and audited. */
  async upsertDefault(
    category: ProductCategory,
    codes: SinCodes,
    actorId: string,
    meta?: RequestMetadata,
  ) {
    await this.validateCodes(codes);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productSinDefault.upsert({
        where: { category },
        create: {
          category,
          sin_activity_code: codes.activityCode,
          sin_product_code: codes.productCode,
          sin_unit_code: codes.unitCode,
        },
        update: {
          sin_activity_code: codes.activityCode,
          sin_product_code: codes.productCode,
          sin_unit_code: codes.unitCode,
        },
      });
      await this.audit.createInTx(tx, {
        userId: actorId,
        event: 'PRODUCT_SIN_DEFAULT_UPDATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { category, ...codes },
      });
      return row;
    });
  }

  /** Copies a category's default onto its products that have no complete codes yet. */
  async applyDefault(
    category: ProductCategory,
    actorId: string,
    meta?: RequestMetadata,
  ): Promise<{ updated: number }> {
    const defaultRow = await this.prisma.productSinDefault.findUnique({
      where: { category },
    });
    if (!defaultRow) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SIN_DEFAULT_NOT_SET',
        message: 'This category has no default SIN codes',
      });
    }
    return this.assignCodes(
      {
        codes: {
          activityCode: defaultRow.sin_activity_code,
          productCode: defaultRow.sin_product_code,
          unitCode: defaultRow.sin_unit_code,
        },
        scope: { category, source: 'category_default' },
        // Filters the update to this category; `scope` above only feeds the audit row.
        category,
        overwrite: false,
      },
      actorId,
      meta,
    );
  }

  /**
   * Assigns the same codes to a selection of products, or to a whole category. Products that are
   * already complete are left alone unless `overwrite` is set.
   */
  async bulkAssign(
    input: {
      codes: SinCodes;
      productIds?: string[];
      category?: ProductCategory;
      overwrite?: boolean;
    },
    actorId: string,
    meta?: RequestMetadata,
  ): Promise<{ updated: number }> {
    if (!input.productIds?.length && !input.category) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'SIN_SCOPE_REQUIRED',
        message: 'Choose products or a category',
      });
    }
    await this.validateCodes(input.codes);
    return this.assignCodes(
      {
        codes: input.codes,
        scope: input.productIds?.length
          ? { productIds: input.productIds.length }
          : { category: input.category },
        productIds: input.productIds,
        category: input.category,
        overwrite: input.overwrite ?? false,
      },
      actorId,
      meta,
    );
  }

  private async assignCodes(
    job: {
      codes: SinCodes;
      scope: Record<string, unknown>;
      productIds?: string[];
      category?: ProductCategory;
      overwrite: boolean;
    },
    actorId: string,
    meta?: RequestMetadata,
  ): Promise<{ updated: number }> {
    const scope: Prisma.ProductWhereInput[] = [
      { active: true, deleted_at: null },
    ];
    if (job.productIds?.length) scope.push({ id: { in: job.productIds } });
    if (job.category) scope.push({ category: job.category });
    if (!job.overwrite) scope.push({ OR: this.incompleteOr() });

    return this.prisma.$transaction(async (tx) => {
      // Read the affected rows first so the audit names each product and its previous codes.
      const affected = await tx.product.findMany({
        where: { AND: scope },
        select: {
          id: true,
          sin_activity_code: true,
          sin_product_code: true,
          sin_unit_code: true,
        },
      });
      if (affected.length === 0) return { updated: 0 };

      const result = await tx.product.updateMany({
        where: { id: { in: affected.map((row) => row.id) } },
        data: {
          sin_activity_code: job.codes.activityCode,
          sin_product_code: job.codes.productCode,
          sin_unit_code: job.codes.unitCode,
        },
      });
      await this.audit.createInTx(tx, {
        userId: actorId,
        event: 'PRODUCT_SIN_CODES_BULK_ASSIGNED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          ...job.scope,
          overwrite: job.overwrite,
          updated: result.count,
          activityCode: job.codes.activityCode,
          productCode: job.codes.productCode,
          unitCode: job.codes.unitCode,
          products: affected.map((row) => ({
            id: row.id,
            previous: {
              activityCode: row.sin_activity_code,
              productCode: row.sin_product_code,
              unitCode: row.sin_unit_code,
            },
          })),
        },
      });
      return { updated: result.count };
    });
  }

  private incompleteOr(): Prisma.ProductWhereInput[] {
    return [
      { sin_activity_code: null },
      { sin_product_code: null },
      { sin_unit_code: null },
    ];
  }
}
