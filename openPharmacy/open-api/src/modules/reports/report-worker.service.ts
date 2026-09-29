import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ReportJobsRepository } from './repositories/report-jobs.repository';
import { ReportsService } from './reports.service';

/** Max jobs drained per poll so a single tick never blocks the loop too long. */
const BATCH_PER_TICK = 5;
/** Run the retention purge roughly every ~10 minutes (300 × 2s poll). */
const PURGE_EVERY_TICKS = 300;

/**
 * In-process work-queue poller.
 *
 * Redis/BullMQ is not available in this deployment, so the queue lives in
 * PostgreSQL: each tick issues a `claim()` (`SELECT … FOR UPDATE SKIP LOCKED`)
 * and hands the job to `ReportsService.executeJob`. The `locked_until` lease and
 * attempt counters (handled in the repository) give us crash recovery and
 * bounded retries without an external broker. `runOnce()` is exposed so tests
 * and a dedicated worker process can drive the queue deterministically.
 */
@Injectable()
export class ReportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportWorkerService.name);
  private readonly workerId = `worker-${randomUUID().slice(0, 8)}`;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private ticks = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: ReportJobsRepository,
    private readonly reports: ReportsService,
  ) {}

  private get enabled(): boolean {
    return this.config.get<boolean>('reports.workerEnabled', true);
  }
  private get pollMs(): number {
    return this.config.get<number>('reports.workerPollMs', 2000);
  }
  private get leaseSec(): number {
    return this.config.get<number>('reports.jobLeaseSec', 120);
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Report worker disabled (REPORT_WORKER_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.timer.unref?.();
    this.logger.log(
      `Report worker started (${this.workerId}) polling every ${this.pollMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      let drained = 0;
      while (drained < BATCH_PER_TICK && (await this.runOnce())) {
        drained += 1;
      }
      if (++this.ticks >= PURGE_EVERY_TICKS) {
        this.ticks = 0;
        const purged = await this.jobs.purgeExpired();
        if (purged > 0) {
          this.logger.log(`Purged stored bytes for ${purged} expired reports`);
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `Report worker tick failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.ticking = false;
    }
  }

  /** Claims and processes exactly one job. Returns false when the queue is empty. */
  async runOnce(): Promise<boolean> {
    const job = await this.jobs.claim(this.workerId, this.leaseSec);
    if (!job) return false;
    await this.reports.executeJob(job);
    return true;
  }
}
