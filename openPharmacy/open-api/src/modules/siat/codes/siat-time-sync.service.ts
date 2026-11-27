import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { SiatProtocolError, SiatRejectedError } from '../client/siat-errors';
import { SiatSoapClient } from '../client/siat-soap.client';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import { SIAT_TIME_OPERATION } from '../catalogs/siat-catalogs.registry';
import { sincronizacionRequest } from '../catalogs/siat-catalogs.payloads';
import { parseSiatDateTime } from './siat-codes.payloads';
import { SiatCodesService } from './siat-codes.service';
import {
  OffsetSiatClock,
  SIAT_CLOCK_ERROR_MS,
  type SiatClockStatus,
} from './siat-offset-clock';
import { resolvePointOfSale } from './siat-point-of-sale-lookup';

/** Emitted when a sample shows the clock more than `SIAT_CLOCK_WARN_MS` away from SIN time. */
export const SIAT_CLOCK_DRIFT_EVENT = 'siat.clock.drift';

export interface SiatClockDriftEvent {
  offsetMs: number;
  sampledAt: Date;
}

export type SiatClockSample =
  | {
      accepted: true;
      offsetMs: number;
      rttMs: number;
      sampledAt: Date;
      siatTime: Date;
    }
  | { accepted: false; reason: 'slow-round-trip'; rttMs: number };

/**
 * Clock synchronization (SIAT-07): one `sincronizarFechaHora` call per sample.
 *
 * The offset is `siatTime − midpoint(request start, response end)`, so half the round trip is the
 * error. A sample whose round trip is above `SIAT_CLOCK_MAX_RTT_MS` is discarded, because its
 * error is too large. The call never retries: a late retry would measure the wrong interval.
 *
 * Any offset is applied. Above `SIAT_CLOCK_WARN_MS` the sample is reported as drift, and above
 * five minutes it is logged as an error (the invoices would be rejected).
 */
@Injectable()
export class SiatTimeSyncService {
  private readonly logger = new Logger(SiatTimeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SiatSoapClient,
    private readonly codes: SiatCodesService,
    private readonly clock: OffsetSiatClock,
    private readonly events: EventEmitter2,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
  ) {}

  async syncTime(
    options: { pointOfSaleId?: string; userId?: string | null } = {},
  ): Promise<SiatClockSample> {
    const identity = await this.codes.identity();
    const pos = await resolvePointOfSale(this.prisma, options.pointOfSaleId);
    const cuis = await this.codes.cuisCode(pos.id, {
      userId: options.userId ?? null,
    });

    const startedAt = Date.now();
    const result = await this.client.invoke(
      SIAT_TIME_OPERATION,
      sincronizacionRequest(
        identity,
        pos.branch.codigo_sucursal,
        pos.codigo_punto_venta,
        cuis,
      ),
      {
        readRetries: 0,
        pointOfSaleId: pos.id,
        metadata: { purpose: 'clock-sync' },
      },
    );
    const endedAt = Date.now();

    if (!result.transaccion) {
      throw new SiatRejectedError(SIAT_TIME_OPERATION.name, result.mensajes);
    }
    const fechaHora = result.payload.fechaHora;
    if (typeof fechaHora !== 'string' || fechaHora === '') {
      throw new SiatProtocolError('SIAT returned no fechaHora');
    }

    const rttMs = endedAt - startedAt;
    if (rttMs > this.config.clockMaxRttMs) {
      this.logger.warn(
        `SIAT clock sample discarded: round trip ${rttMs} ms is above ${this.config.clockMaxRttMs} ms`,
      );
      return { accepted: false, reason: 'slow-round-trip', rttMs };
    }

    const siatTime = parseSiatDateTime(fechaHora);
    const midpoint = new Date(Math.round((startedAt + endedAt) / 2));
    const offsetMs = Math.round(siatTime.getTime() - midpoint.getTime());

    const row = await this.prisma.siatTimeOffset.create({
      data: {
        siat_time: siatTime,
        server_time: midpoint,
        offset_ms: offsetMs,
      },
    });
    this.clock.update(offsetMs, row.created_at);

    if (Math.abs(offsetMs) > SIAT_CLOCK_ERROR_MS) {
      this.logger.error(
        `SIAT clock is ${offsetMs} ms off. Invoices will be rejected until it is corrected.`,
      );
    } else if (Math.abs(offsetMs) > this.config.clockWarnMs) {
      this.logger.warn(`SIAT clock is ${offsetMs} ms off`);
    }
    if (Math.abs(offsetMs) > this.config.clockWarnMs) {
      const drift: SiatClockDriftEvent = {
        offsetMs,
        sampledAt: row.created_at,
      };
      this.events.emit(SIAT_CLOCK_DRIFT_EVENT, drift);
    }

    return {
      accepted: true,
      offsetMs,
      rttMs,
      sampledAt: row.created_at,
      siatTime,
    };
  }

  clockStatus(): SiatClockStatus {
    return this.clock.status(new Date());
  }
}
