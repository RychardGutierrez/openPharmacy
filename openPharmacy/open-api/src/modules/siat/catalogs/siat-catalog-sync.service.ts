import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SiatRejectedError } from '../client/siat-errors';
import { SiatSoapClient } from '../client/siat-soap.client';
import { SIAT_CLOCK, type SiatClock } from '../codes/siat-clock';
import { SiatCodesService } from '../codes/siat-codes.service';
import { resolvePointOfSale } from '../codes/siat-point-of-sale-lookup';
import {
  SiatTimeSyncService,
  type SiatClockSample,
} from '../codes/siat-time-sync.service';
import {
  SIAT_CATALOG_ENTRIES,
  findCatalogEntry,
  type SiatCatalogEntry,
} from './siat-catalogs.registry';
import {
  sincronizacionRequest,
  toArray,
  uniqueRows,
  type SiatCatalogRow,
} from './siat-catalogs.payloads';

/** Long enough for the largest catalog (products) in one transaction. */
const TRANSACTION_TIMEOUT_MS = 120_000;

export interface SiatCatalogSyncResult {
  slug: string;
  catalog: string;
  status: 'synced' | 'failed';
  /** New codes. */
  added: number;
  /** Codes whose description, parent or extra changed. */
  updated: number;
  /** Codes that left the SIN list. Kept as inactive rows, never deleted. */
  deactivated: number;
  /** Codes that came back after being inactive. */
  reactivated: number;
  /** Active codes after the sync. */
  total: number;
  error?: string;
}

export interface SiatSyncSummary {
  clock:
    | { accepted: true; offsetMs: number }
    | { accepted: false; error: string };
  catalogs: SiatCatalogSyncResult[];
}

interface SyncOptions {
  pointOfSaleId?: string;
  userId?: string | null;
}

/**
 * Synchronizes the SIN catalogs into `siat_catalog_items` (SIAT-07).
 *
 * Idempotent: a sync that finds the same content writes nothing item-level. Codes that disappear
 * are deactivated, not deleted, because old invoices refer to them.
 *
 * Failure rules:
 * - One catalog failing does not stop the others.
 * - SIAT refusing the request (`transaccion=false`) or answering an empty list while codes exist
 *   changes nothing. The catalog is marked failed. Otherwise a bad answer would empty the catalog.
 * - The failure is recorded in `siat_catalog_sync.last_error`.
 */
@Injectable()
export class SiatCatalogSyncService {
  private readonly logger = new Logger(SiatCatalogSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SiatSoapClient,
    private readonly codes: SiatCodesService,
    private readonly timeSync: SiatTimeSyncService,
    private readonly audit: AuditLogRepository,
    @Inject(SIAT_CLOCK) private readonly clock: SiatClock,
  ) {}

  /** Clock first, then every catalog in sequence. Throws only when SIAT is not configured. */
  async syncAll(options: SyncOptions = {}): Promise<SiatSyncSummary> {
    // Fail fast with a 409 when the settings are incomplete, rather than one error per catalog.
    await this.codes.identity();

    let clock: SiatSyncSummary['clock'];
    try {
      const sample: SiatClockSample = await this.timeSync.syncTime(options);
      clock = sample.accepted
        ? { accepted: true, offsetMs: sample.offsetMs }
        : { accepted: false, error: sample.reason };
    } catch (error) {
      clock = { accepted: false, error: errorMessage(error) };
    }

    const catalogs: SiatCatalogSyncResult[] = [];
    for (const entry of SIAT_CATALOG_ENTRIES) {
      catalogs.push(await this.syncEntry(entry, options));
    }
    return { clock, catalogs };
  }

  async syncCatalog(
    slug: string,
    options: SyncOptions = {},
  ): Promise<SiatCatalogSyncResult> {
    const entry = findCatalogEntry(slug);
    if (!entry) {
      throw new NotFoundException({
        code: 'SIAT_CATALOG_UNKNOWN',
        message: `Unknown catalog "${slug}"`,
      });
    }
    await this.codes.identity();
    return this.syncEntry(entry, options);
  }

  /**
   * Manual "Sync now" (ADMIN). Audited with the summary, not the codes.
   * `catalog` limits the run to one catalog; the clock is refreshed only for a full sync.
   */
  async syncNow(input: { catalog?: string; userId: string }): Promise<
    Partial<Pick<SiatSyncSummary, 'clock'>> & {
      catalogs: SiatCatalogSyncResult[];
    }
  > {
    const result = input.catalog
      ? {
          catalogs: [
            await this.syncCatalog(input.catalog, { userId: input.userId }),
          ],
        }
      : await this.syncAll({ userId: input.userId });

    const synced = result.catalogs.filter((c) => c.status === 'synced').length;
    await this.audit.create({
      userId: input.userId,
      event: 'SIAT_CATALOGS_SYNCED',
      metadata: {
        catalog: input.catalog ?? 'all',
        synced,
        failed: result.catalogs.length - synced,
      },
    });
    return result;
  }

  private async syncEntry(
    entry: SiatCatalogEntry,
    options: SyncOptions,
  ): Promise<SiatCatalogSyncResult> {
    const catalog = entry.operation.name;
    try {
      const identity = await this.codes.identity();
      const pos = await resolvePointOfSale(this.prisma, options.pointOfSaleId);
      const cuis = await this.codes.cuisCode(pos.id, {
        userId: options.userId ?? null,
      });

      const result = await this.client.invoke(
        entry.operation,
        sincronizacionRequest(
          identity,
          pos.branch.codigo_sucursal,
          pos.codigo_punto_venta,
          cuis,
        ),
        {
          pointOfSaleId: pos.id,
          metadata: { purpose: 'catalog-sync', catalog: entry.slug },
        },
      );
      if (!result.transaccion) {
        throw new SiatRejectedError(catalog, result.mensajes);
      }

      const parsed: SiatCatalogRow[] = [];
      for (const item of toArray(result.payload[entry.listKey])) {
        const row = entry.map(item);
        if (row) parsed.push(row);
      }
      const { rows, duplicates } = uniqueRows(parsed);
      if (duplicates > 0) {
        this.logger.warn(
          `${catalog}: SIAT sent ${duplicates} duplicate code(s); the last one was kept`,
        );
      }

      return await this.apply(entry, rows, pos.id);
    } catch (error) {
      const message = errorMessage(error);
      this.logger.error(`Catalog sync failed for ${entry.slug}: ${message}`);
      await this.recordAttempt(catalog, message, options.pointOfSaleId).catch(
        (recordError: unknown) =>
          this.logger.error(
            `Could not record the failed sync of ${entry.slug}: ${errorMessage(recordError)}`,
          ),
      );
      return {
        slug: entry.slug,
        catalog,
        status: 'failed',
        added: 0,
        updated: 0,
        deactivated: 0,
        reactivated: 0,
        total: 0,
        error: message,
      };
    }
  }

  /** Writes the SIN list in one transaction, under a per-catalog advisory lock. */
  private async apply(
    entry: SiatCatalogEntry,
    rows: Map<string, SiatCatalogRow>,
    pointOfSaleId: string,
  ): Promise<SiatCatalogSyncResult> {
    const catalog = entry.operation.name;
    const now = this.clock.now();

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'siat-catalog:' + catalog}))`;

        const existing = await tx.siatCatalogItem.findMany({
          where: { catalog },
        });
        const activeBefore = existing.filter((row) => row.active);
        if (rows.size === 0 && activeBefore.length > 0) {
          throw new Error(
            'SIAT returned an empty list; the active codes were kept',
          );
        }

        const byCode = new Map(existing.map((row) => [row.code, row]));
        const toCreate: Prisma.SiatCatalogItemCreateManyInput[] = [];
        let added = 0;
        let updated = 0;
        let reactivated = 0;

        for (const row of rows.values()) {
          const prev = byCode.get(row.code);
          const extra = row.extra
            ? (row.extra as Prisma.InputJsonValue)
            : Prisma.JsonNull;
          if (!prev) {
            toCreate.push({
              catalog,
              code: row.code,
              description: row.description,
              parent_code: row.parentCode,
              extra,
              active: true,
              synced_at: now,
            });
            added += 1;
            continue;
          }
          const changed =
            prev.description !== row.description ||
            prev.parent_code !== row.parentCode ||
            JSON.stringify(prev.extra ?? null) !==
              JSON.stringify(row.extra ?? null);
          if (!prev.active) {
            reactivated += 1;
          } else if (changed) {
            updated += 1;
          }
          if (!prev.active || changed) {
            await tx.siatCatalogItem.update({
              where: { id: prev.id },
              data: {
                description: row.description,
                parent_code: row.parentCode,
                extra,
                active: true,
                synced_at: now,
              },
            });
          }
        }

        const missing = activeBefore
          .map((row) => row.code)
          .filter((code) => !rows.has(code));
        if (missing.length > 0) {
          await tx.siatCatalogItem.updateMany({
            where: { catalog, active: true, code: { in: missing } },
            data: { active: false, synced_at: now },
          });
        }
        if (toCreate.length > 0) {
          await tx.siatCatalogItem.createMany({ data: toCreate });
        }

        const syncFields = {
          last_attempt_at: now,
          last_success_at: now,
          item_count: rows.size,
          last_error: null,
          point_of_sale_id: pointOfSaleId,
        };
        await tx.siatCatalogSync.upsert({
          where: { catalog },
          create: { catalog, ...syncFields },
          update: syncFields,
        });

        return {
          slug: entry.slug,
          catalog,
          status: 'synced' as const,
          added,
          updated,
          deactivated: missing.length,
          reactivated,
          total: rows.size,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 },
    );
  }

  private async recordAttempt(
    catalog: string,
    error: string,
    pointOfSaleId?: string,
  ): Promise<void> {
    const now = this.clock.now();
    await this.prisma.siatCatalogSync.upsert({
      where: { catalog },
      create: {
        catalog,
        last_attempt_at: now,
        item_count: 0,
        last_error: error,
        point_of_sale_id: pointOfSaleId ?? null,
      },
      update: { last_attempt_at: now, last_error: error },
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
