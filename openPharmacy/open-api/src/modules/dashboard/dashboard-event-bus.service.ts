import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Client } from 'pg';
import { Subject } from 'rxjs';
import { LotExpiryAlertEvent } from '../lots/events/lot-expiry-alert.event';
import type { DashboardSseEvent } from './dashboard.service';

const CHANNEL = 'dashboard_events';

/** Cross-instance dashboard event transport backed by PostgreSQL NOTIFY. */
@Injectable()
export class DashboardEventBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardEventBus.name);
  private readonly client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  readonly events = new Subject<DashboardSseEvent>();

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.client.on('notification', (message) => {
        if (message.channel !== CHANNEL || !message.payload) return;

        try {
          this.events.next(JSON.parse(message.payload) as DashboardSseEvent);
        } catch (error) {
          this.logger.warn(
            `Ignoring malformed ${CHANNEL} payload: ${String(error)}`,
          );
        }
      });
      await this.client.query(`LISTEN ${CHANNEL}`);
    } catch (error) {
      this.logger.error(
        'Dashboard event listener could not connect; SSE will remain local to this process',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.end();
    } catch {
      // The connection may already be closed during application shutdown.
    }
  }

  @OnEvent('sale.created')
  async publishSale(payload: Record<string, unknown>): Promise<void> {
    await this.publish({ type: 'sale.created', data: payload });
  }

  @OnEvent('lot.expiry-alert')
  async publishAlert(payload: LotExpiryAlertEvent): Promise<void> {
    await this.publish({
      type: 'alert.triggered',
      data: {
        lotId: payload.lotId,
        productId: payload.productId,
        lotNumber: payload.lotNumber,
        productName: payload.productName,
        expiryDate: payload.expiryDate,
        status: payload.status,
        daysUntilExpiry: payload.daysUntilExpiry,
      },
    });
  }

  private async publish(event: DashboardSseEvent): Promise<void> {
    try {
      await this.client.query('SELECT pg_notify($1, $2)', [
        CHANNEL,
        JSON.stringify(event),
      ]);
    } catch (error) {
      this.logger.error(
        'Failed to publish dashboard event',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
