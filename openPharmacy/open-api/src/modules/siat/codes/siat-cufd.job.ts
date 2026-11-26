import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import { SiatCufdService } from './siat-cufd.service';

/**
 * CUFD sweep (SIAT-06), every `SIAT_CUFD_SWEEP_MS` (default 1 min). The policy decides what is due
 * (daily rotation, safety net, stale or expired CUFD), so no cron expression is needed and the
 * rotation happens within one interval of `SIAT_CUFD_ROTATE_AT`. Failed points of sale wait out
 * their backoff. Does nothing while `SIAT_ENABLED` is false. Disabled in tests (`NODE_ENV=test`).
 *
 * With several API instances each one sweeps; the row lock in `SiatCufdService` keeps it to one
 * SIAT request per point of sale.
 */
@Injectable()
export class SiatCufdJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SiatCufdJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly cufd: SiatCufdService,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), this.config.cufdSweepMs);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const summary = await this.cufd.renewDue();
      if (summary.renewed || summary.failed) {
        this.logger.log(
          `CUFD sweep: ${summary.renewed} issued, ${summary.failed} failed, ${summary.deferred} waiting to retry`,
        );
      }
    } catch (error) {
      this.logger.error(`CUFD sweep failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
