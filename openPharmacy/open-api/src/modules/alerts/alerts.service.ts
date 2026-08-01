import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LotExpiryAlertEvent } from '../../modules/lots/events/lot-expiry-alert.event';
import { LotsService } from '../../modules/lots/lots.service';
import { ExpiryDashboardLotDto } from '../../modules/lots/dto/expiry-dashboard-response.dto';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const RED_DAYS = 30;
const ORANGE_DAYS = 90;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private lastScanAt: number | null = null;
  private readonly emittedKeys = new Set<string>();

  constructor(
    private readonly lotsService: LotsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Returns the current alert snapshot (all RED/ORANGE lots).
   */
  async getCurrentAlerts(): Promise<ExpiryDashboardLotDto[]> {
    const dashboard = await this.lotsService.getExpiryDashboard();
    return [...dashboard.red.lots, ...dashboard.orange.lots];
  }

  /**
   * Lazy 6-hour scan for newly-crossed threshold lots.
   * Triggered on SSE connect, GET /alerts, or after lot-changing events.
   */
  async checkNewlyCrossed(): Promise<LotExpiryAlertEvent[]> {
    const now = Date.now();

    if (this.lastScanAt && now - this.lastScanAt < SIX_HOURS_MS) {
      return [];
    }

    const windowStart = this.lastScanAt ?? now - SIX_HOURS_MS;
    this.lastScanAt = now;

    const dashboard = await this.lotsService.getExpiryDashboard();
    const alerts: LotExpiryAlertEvent[] = [];

    for (const lot of [...dashboard.red.lots, ...dashboard.orange.lots]) {
      if (this.isNewlyCrossed(lot, windowStart, now)) {
        const key = `${lot.id}:${lot.status}`;
        if (this.emittedKeys.has(key)) continue;
        this.emittedKeys.add(key);

        const event = new LotExpiryAlertEvent(
          lot.id,
          lot.productId,
          lot.lotNumber,
          lot.productName,
          lot.expiryDate,
          lot.status,
          lot.daysUntilExpiry,
        );

        alerts.push(event);
        this.eventEmitter
          .emitAsync('lot.expiry-alert', event)
          .catch((error: unknown) => {
            this.logger.error(
              `Failed to emit lot.expiry-alert for ${lot.id}`,
              error instanceof Error ? error.stack : String(error),
            );
          });
      }
    }

    return alerts;
  }

  /**
   * Force an immediate re-scan (used by tests or manual refresh).
   */
  async forceCheck(): Promise<LotExpiryAlertEvent[]> {
    this.lastScanAt = null;
    return this.checkNewlyCrossed();
  }

  private isNewlyCrossed(
    lot: ExpiryDashboardLotDto,
    windowStart: number,
    now: number,
  ): boolean {
    const thresholdDays = lot.status === 'RED' ? RED_DAYS : ORANGE_DAYS;
    const expiry = new Date(lot.expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);

    // The moment this lot crossed into the threshold: expiry_date - thresholdDays
    const crossingDate = new Date(expiry);
    crossingDate.setUTCDate(crossingDate.getUTCDate() - thresholdDays);
    crossingDate.setUTCHours(0, 0, 0, 0);

    const crossedAt = crossingDate.getTime();
    return crossedAt > windowStart && crossedAt <= now;
  }

  @OnEvent('lot.created')
  async handleLotCreated(): Promise<void> {
    await this.runCheckAfterEvent('lot.created');
  }

  @OnEvent('lot.updated')
  async handleLotUpdated(): Promise<void> {
    await this.runCheckAfterEvent('lot.updated');
  }

  @OnEvent('lot.voided')
  async handleLotVoided(): Promise<void> {
    await this.runCheckAfterEvent('lot.voided');
  }

  private async runCheckAfterEvent(source: string): Promise<void> {
    try {
      await this.checkNewlyCrossed();
    } catch (error: unknown) {
      this.logger.error(
        `Expiry scan failed after ${source}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
