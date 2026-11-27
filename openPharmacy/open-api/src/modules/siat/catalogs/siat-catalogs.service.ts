import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  OffsetSiatClock,
  type SiatClockStatus,
} from '../codes/siat-offset-clock';
import { ConfigService as PharmacyConfigService } from '../../config/config.service';
import {
  SIAT_CATALOG_ENTRIES,
  findCatalogEntry,
  type SiatCatalogEntry,
} from './siat-catalogs.registry';

/** `sincronizarParametricaTipoPuntoVenta`. Comisionista (type 1) uses another operation. */
const POS_TYPES_CATALOG = 'sincronizarParametricaTipoPuntoVenta';
const COMISIONISTA = /COMISIONISTA/i;

export interface SiatCatalogListQuery {
  parentCode?: string;
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SiatCatalogStatusRow {
  slug: string;
  catalog: string;
  requiredForEmission: boolean;
  public: boolean;
  activeCount: number;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
}

export interface SiatCatalogsStatus {
  catalogs: SiatCatalogStatusRow[];
  /** Slugs whose last sync failed. */
  failing: string[];
  /** Required for emission and with no active code. */
  missingForEmission: string[];
  clock: SiatClockStatus;
}

/**
 * Read side of the SIN catalogs (SIAT-07): the lists the frontend and the emission code use.
 * Writes live in `SiatCatalogSyncService`.
 */
@Injectable()
export class SiatCatalogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PharmacyConfigService,
    @Inject(OffsetSiatClock) private readonly clock: OffsetSiatClock,
  ) {}

  /**
   * Active codes of a catalog, with optional parent filter and text search. Non-public catalogs
   * are ADMIN only. Synchronization fields are not returned.
   */
  async list(slug: string, query: SiatCatalogListQuery, role: UserRole) {
    const entry = this.entry(slug);
    if (!entry.public && role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'SIAT_CATALOG_FORBIDDEN',
        message: 'Only an administrator can read this catalog',
      });
    }

    const pageSize = Math.min(query.pageSize ?? 50, 200);
    const page = Math.max(query.page ?? 1, 1);
    const where = {
      catalog: entry.operation.name,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.parentCode ? { parent_code: query.parentCode } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { startsWith: query.search } },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.siatCatalogItem.count({ where }),
      this.prisma.siatCatalogItem.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          code: true,
          parent_code: true,
          description: true,
          extra: true,
          active: true,
        },
      }),
    ]);

    return {
      catalog: entry.slug,
      page,
      pageSize,
      total,
      items: rows.map((row) => ({
        code: row.code,
        parentCode: row.parent_code,
        description: row.description,
        extra: row.extra,
        active: row.active,
      })),
    };
  }

  /** Per-catalog counts and sync state, plus the clock. Admin view. */
  async status(): Promise<SiatCatalogsStatus> {
    const [counts, syncs] = await Promise.all([
      this.prisma.siatCatalogItem.groupBy({
        by: ['catalog'],
        where: { active: true },
        _count: { _all: true },
      }),
      this.prisma.siatCatalogSync.findMany(),
    ]);
    const activeByCatalog = new Map(
      counts.map((c) => [c.catalog, c._count._all]),
    );
    const syncByCatalog = new Map(syncs.map((s) => [s.catalog, s]));

    const catalogs: SiatCatalogStatusRow[] = SIAT_CATALOG_ENTRIES.map(
      (entry) => {
        const sync = syncByCatalog.get(entry.operation.name);
        return {
          slug: entry.slug,
          catalog: entry.operation.name,
          requiredForEmission: entry.requiredForEmission,
          public: entry.public,
          activeCount: activeByCatalog.get(entry.operation.name) ?? 0,
          lastAttemptAt: sync?.last_attempt_at ?? null,
          lastSuccessAt: sync?.last_success_at ?? null,
          lastError: sync?.last_error ?? null,
        };
      },
    );

    return {
      catalogs,
      failing: catalogs.filter((c) => c.lastError).map((c) => c.slug),
      missingForEmission: catalogs
        .filter((c) => c.requiredForEmission && c.activeCount === 0)
        .map((c) => c.slug),
      clock: this.clock.status(new Date()),
    };
  }

  async isActiveCode(slug: string, code: string): Promise<boolean> {
    const entry = this.entry(slug);
    const count = await this.prisma.siatCatalogItem.count({
      where: { catalog: entry.operation.name, code, active: true },
    });
    return count > 0;
  }

  /** True when the catalog has at least one active code, i.e. it has been synchronized. */
  async hasActiveCodes(slug: string): Promise<boolean> {
    const entry = this.entry(slug);
    const count = await this.prisma.siatCatalogItem.count({
      where: { catalog: entry.operation.name, active: true },
    });
    return count > 0;
  }

  /**
   * Checks the SIN homologation codes of a product (SIAT-08). The activity must be one registered
   * on the NIT. The product code is looked up as `activity:product`, so it must belong to that
   * activity. Returns the failing fields, empty when all three are valid.
   */
  async validateSinCodes(codes: {
    activityCode: string;
    productCode: string;
    unitCode: string;
  }): Promise<{ field: 'sinActivityCode' | 'sinProductCode' | 'sinUnitCode'; code: string }[]> {
    const [activityOk, productOk, unitOk] = await Promise.all([
      this.isActiveCode('activities', codes.activityCode),
      this.isActiveCode(
        'products',
        `${codes.activityCode}:${codes.productCode}`,
      ),
      this.isActiveCode('units', codes.unitCode),
    ]);
    const failures: {
      field: 'sinActivityCode' | 'sinProductCode' | 'sinUnitCode';
      code: string;
    }[] = [];
    if (!activityOk)
      failures.push({ field: 'sinActivityCode', code: codes.activityCode });
    if (!productOk)
      failures.push({ field: 'sinProductCode', code: codes.productCode });
    if (!unitOk) failures.push({ field: 'sinUnitCode', code: codes.unitCode });
    return failures;
  }

  /**
   * One legend for an invoice, chosen at random among the active legends of its activity (SIAT
   * expert rule). Null when the activity has none.
   */
  async randomLegend(
    activityCode: string,
  ): Promise<{ code: string; description: string } | null> {
    const legends = await this.prisma.siatCatalogItem.findMany({
      where: {
        catalog: this.entry('legends').operation.name,
        parent_code: activityCode,
        active: true,
      },
      select: { code: true, description: true },
      orderBy: { code: 'asc' },
    });
    if (legends.length === 0) return null;
    return legends[randomInt(legends.length)];
  }

  /**
   * Throws 409 `SIAT_CATALOGS_MISSING` when an emission-required catalog has no active code, or
   * when the default activity has no active code or no legend. Called by SIAT-11 before emission.
   */
  async assertReadyForEmission(): Promise<void> {
    const status = await this.status();
    const missing = [...status.missingForEmission];

    const stored = await this.settings.getStoredValues([
      'SIAT_DEFAULT_ACTIVITY',
    ]);
    const activity =
      typeof stored.SIAT_DEFAULT_ACTIVITY === 'string'
        ? stored.SIAT_DEFAULT_ACTIVITY.trim()
        : '';
    if (!activity) {
      missing.push('defaultActivity');
    } else {
      const [activeCount, legendCount] = await Promise.all([
        this.prisma.siatCatalogItem.count({
          where: {
            catalog: this.entry('activities').operation.name,
            code: activity,
            active: true,
          },
        }),
        this.prisma.siatCatalogItem.count({
          where: {
            catalog: this.entry('legends').operation.name,
            parent_code: activity,
            active: true,
          },
        }),
      ]);
      if (activeCount === 0) missing.push(`activity:${activity}`);
      if (legendCount === 0) missing.push(`legends:${activity}`);
    }

    if (missing.length > 0) {
      throw new ConflictException({
        code: 'SIAT_CATALOGS_MISSING',
        message:
          'The SIN catalogs needed to emit invoices are missing. Sync them first.',
        missing,
      });
    }
  }

  /**
   * Point-of-sale types for registration, from the synced catalog. Comisionista is excluded. 409
   * until the catalog has been synchronized.
   */
  async pointOfSaleTypes(): Promise<{ codigo: number; descripcion: string }[]> {
    const rows = await this.prisma.siatCatalogItem.findMany({
      where: { catalog: POS_TYPES_CATALOG, active: true },
      select: { code: true, description: true },
      orderBy: { code: 'asc' },
    });
    if (rows.length === 0) {
      throw new ConflictException({
        code: 'SIAT_CATALOG_NOT_SYNCED',
        message: 'The point-of-sale types have not been synchronized yet',
      });
    }
    return rows
      .filter((row) => !COMISIONISTA.test(row.description))
      .map((row) => ({
        codigo: Number(row.code),
        descripcion: row.description,
      }))
      .filter((type) => Number.isInteger(type.codigo));
  }

  private entry(slug: string): SiatCatalogEntry {
    const entry = findCatalogEntry(slug);
    if (!entry) {
      throw new NotFoundException({
        code: 'SIAT_CATALOG_UNKNOWN',
        message: `Unknown catalog "${slug}"`,
      });
    }
    return entry;
  }
}
