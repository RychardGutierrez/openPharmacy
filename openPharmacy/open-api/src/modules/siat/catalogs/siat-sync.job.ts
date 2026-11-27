import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import { SiatCodesService } from '../codes/siat-codes.service';
import { SiatTimeSyncService } from '../codes/siat-time-sync.service';
import { SiatCatalogSyncService } from './siat-catalog-sync.service';
import { SIAT_CATALOG_ENTRIES } from './siat-catalogs.registry';

/** Bolivia is UTC-4 all year (no DST). */
const BOLIVIA_OFFSET_MS = 4 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const CATALOG_SWEEP_MS = 5 * 60_000;
/** A catalog that failed is retried at most this often, not on every sweep. */
const CATALOG_RETRY_MS = 30 * 60_000;

/**
 * The most recent daily catalog sync time (`minuteOfDay`, Bolivia) at or before `now`.
 * Pure, so it can be tested without a clock.
 */
export function latestCatalogSyncDue(now: Date, minuteOfDay: number): Date {
  const local = new Date(now.getTime() - BOLIVIA_OFFSET_MS);
  let due =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      0,
      minuteOfDay,
    ) + BOLIVIA_OFFSET_MS;
  if (due > now.getTime()) due -= DAY_MS;
  return new Date(due);
}

/**
 * SIAT-07 background work. Two timers, both no-ops while `SIAT_ENABLED` is false and disabled under
 * `NODE_ENV=test`:
 * - the clock, re-sampled every `SIAT_CLOCK_SYNC_MS` (default 1 h);
 * - the catalogs, synchronized once a day after `SIAT_CATALOG_SYNC_AT` (default 01:00 Bolivia).
 *   A sweep every 5 min runs the sync when some catalog has not succeeded since the last due time,
 *   and at most once per 30 min while a catalog keeps failing.
 *
 * With several API instances each one may run it; the advisory lock in `SiatCatalogSyncService`
 * keeps each catalog to one write at a time.
 */
@Injectable()
export class SiatSyncJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SiatSyncJob.name);
  private clockTimer?: NodeJS.Timeout;
  private catalogTimer?: NodeJS.Timeout;
  private clockRunning = false;
  private catalogRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: SiatCodesService,
    private readonly timeSync: SiatTimeSyncService,
    private readonly catalogSync: SiatCatalogSyncService,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.clockTimer = setInterval(
      () => void this.runClock(),
      this.config.clockSyncMs,
    );
    this.clockTimer.unref();
    this.catalogTimer = setInterval(
      () => void this.runCatalogs(),
      CATALOG_SWEEP_MS,
    );
    this.catalogTimer.unref();
    void this.runClock();
    void this.runCatalogs();
  }

  onModuleDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.catalogTimer) clearInterval(this.catalogTimer);
  }

  async runClock(): Promise<void> {
    if (this.clockRunning) return;
    this.clockRunning = true;
    try {
      if (!(await this.codes.siatEnabled())) return;
      await this.timeSync.syncTime();
    } catch (error) {
      this.logger.warn(`SIAT clock sync skipped: ${String(error)}`);
    } finally {
      this.clockRunning = false;
    }
  }

  async runCatalogs(): Promise<void> {
    if (this.catalogRunning) return;
    this.catalogRunning = true;
    try {
      if (!(await this.codes.siatEnabled())) return;
      if (!(await this.catalogsDue(new Date()))) return;
      const summary = await this.catalogSync.syncAll();
      const failed = summary.catalogs.filter((c) => c.status === 'failed');
      this.logger.log(
        `SIAT catalog sync: ${summary.catalogs.length - failed.length} synced, ${failed.length} failed`,
      );
    } catch (error) {
      this.logger.error(`SIAT catalog sync failed: ${String(error)}`);
    } finally {
      this.catalogRunning = false;
    }
  }

  /**
   * Due when some catalog has no success since the latest due time, and no attempt was made in
   * the last `CATALOG_RETRY_MS`.
   */
  private async catalogsDue(now: Date): Promise<boolean> {
    const due = latestCatalogSyncDue(now, this.config.catalogSyncMinute);
    const syncs = await this.prisma.siatCatalogSync.findMany({
      select: { catalog: true, last_success_at: true, last_attempt_at: true },
    });
    const byCatalog = new Map(syncs.map((s) => [s.catalog, s]));

    const stale = SIAT_CATALOG_ENTRIES.some((entry) => {
      const sync = byCatalog.get(entry.operation.name);
      return !sync?.last_success_at || sync.last_success_at < due;
    });
    if (!stale) return false;

    const lastAttempt = Math.max(
      0,
      ...syncs.map((s) => s.last_attempt_at?.getTime() ?? 0),
    );
    return now.getTime() - lastAttempt >= CATALOG_RETRY_MS;
  }
}
