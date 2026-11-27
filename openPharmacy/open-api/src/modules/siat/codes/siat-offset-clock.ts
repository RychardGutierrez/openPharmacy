import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import type { SiatClock } from './siat-clock';

/** A clock off by more than this is logged as an error (SIAT-07). */
export const SIAT_CLOCK_ERROR_MS = 5 * 60_000;
/** The last sample is "stale" after this long without a new one. */
export const SIAT_CLOCK_STALE_MS = 2 * 60 * 60_000;

export interface SiatClockStatus {
  offsetMs: number;
  /** When the offset was last sampled, or null when no sample exists yet. */
  sampledAt: Date | null;
  stale: boolean;
  /** |offset| is above `SIAT_CLOCK_WARN_MS`. */
  warning: boolean;
}

/**
 * The SIAT clock (SIAT-07): server time corrected by the offset from `sincronizarFechaHora`.
 * Every SIAT timestamp (invoices, events, codes) is taken from here. `now()` stays synchronous: the
 * offset is held in memory and loaded from `siat_time_offset` at startup.
 *
 * With no sample yet the offset is 0, so the server clock is used until the first sync.
 */
@Injectable()
export class OffsetSiatClock implements SiatClock, OnModuleInit {
  private readonly logger = new Logger(OffsetSiatClock.name);
  private offsetMs = 0;
  private sampledAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const last = await this.prisma.siatTimeOffset.findFirst({
        orderBy: { created_at: 'desc' },
      });
      if (last) this.update(last.offset_ms, last.created_at);
    } catch (error) {
      // The table may not be migrated yet. The server clock is a safe fallback until a sync.
      this.logger.warn(`SIAT clock offset not loaded: ${String(error)}`);
    }
  }

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  /** Applies a new offset. Called by `SiatTimeSyncService` after each accepted sample. */
  update(offsetMs: number, sampledAt: Date): void {
    this.offsetMs = offsetMs;
    this.sampledAt = sampledAt;
  }

  status(at: Date = new Date()): SiatClockStatus {
    return {
      offsetMs: this.offsetMs,
      sampledAt: this.sampledAt,
      stale:
        this.sampledAt === null ||
        at.getTime() - this.sampledAt.getTime() > SIAT_CLOCK_STALE_MS,
      warning: Math.abs(this.offsetMs) > this.config.clockWarnMs,
    };
  }
}
