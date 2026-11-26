import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { SiatCodesService } from './siat-codes.service';

/** One sweep per hour. A CUIS lasts about a year, so this is far more often than needed. */
const INTERVAL_MS = 60 * 60_000;

/**
 * Hourly CUIS renewal sweep (SIAT-05). Inside the renewal window (`SIAT_CUIS_RENEW_DAYS`, the annex
 * allows 5) it requests a new CUIS; inside the alert window (`SIAT_CUIS_ALERT_DAYS`) it only
 * warns. Does nothing while `SIAT_ENABLED` is false. Disabled in tests (`NODE_ENV=test`).
 *
 * With several API instances each one sweeps; the row lock in `SiatCodesService` keeps it to one
 * SIAT request per point of sale.
 */
@Injectable()
export class SiatCuisRenewalJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SiatCuisRenewalJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly codes: SiatCodesService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
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
      const summary = await this.codes.renewDue();
      if (summary.renewed || summary.failed) {
        this.logger.log(
          `CUIS sweep: ${summary.renewed} renewed, ${summary.failed} failed, ${summary.alerts} near expiry`,
        );
      }
    } catch (error) {
      this.logger.error(`CUIS sweep failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
