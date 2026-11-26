import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SiatCufdSource } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SiatRejectedError } from '../client/siat-errors';
import { SIAT_OPERATIONS } from '../client/siat-operations';
import { SiatSoapClient } from '../client/siat-soap.client';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import { SIAT_CLOCK, type SiatClock } from './siat-clock';
import { cufdRequest, cufdResponse } from './siat-codes.payloads';
import {
  SIAT_CUIS_RENEWED_EVENT,
  SiatCodesService,
  type SiatCuisRenewedEvent,
} from './siat-codes.service';
import {
  cufdMinutesLeft,
  cufdNeedsRequest,
  cufdRetryDelayMs,
  cufdState,
  cufdUsable,
  type SiatCufdState,
  type SiatCufdTimes,
} from './siat-cufd-policy';

/**
 * Emitted once per outage when a point of sale has no valid CUFD and SIAT could not issue one.
 * SIAT-17 (contingency) and SIAT-27 (alerts) subscribe to it.
 */
export const SIAT_CUFD_UNAVAILABLE_EVENT = 'siat.cufd.unavailable';

export interface SiatCufdUnavailableEvent {
  pointOfSaleId: string;
  codigoSucursal: number;
  codigoPuntoVenta: number;
  /** When the last valid CUFD expired, or null when none was ever stored. */
  expiredAt: Date | null;
  error: string;
}

/** A stored CUFD with its codes. Internal use only (CUF, invoice header): never sent to a browser. */
export interface SiatCufdRecord {
  id: string;
  pointOfSaleId: string;
  codigo: string;
  codigoControl: string;
  direccion: string;
  codigoInterno: string | null;
  validFrom: Date;
  validUntil: Date;
  cuisId: string | null;
}

/** CUFD status of one point of sale. Never contains the codes. */
export interface SiatCufdStatus {
  pointOfSaleId: string;
  codigoSucursal: number;
  codigoPuntoVenta: number;
  state: SiatCufdState;
  validUntil: Date | null;
  minutesLeft: number | null;
  /** `stored`: no SIAT call was made. `siat`: a new CUFD was issued in this call. */
  source: 'stored' | 'siat';
  /** SIAT failed, but the stored CUFD is still usable, so it was kept. */
  renewalFailed?: boolean;
}

export interface EnsureCufdOptions {
  source: SiatCufdSource;
  /** Ask SIAT even when the stored CUFD is valid. Errors are thrown. */
  force?: boolean;
  userId?: string | null;
  correlationId?: string;
}

type PointOfSaleRef = {
  id: string;
  codigo_punto_venta: number;
  closed_at: Date | null;
  branch: { codigo_sucursal: number };
};

type StoredCufd = SiatCufdTimes & { id: string };

const CUFD_TIMES = {
  id: true,
  valid_from: true,
  valid_until: true,
  cuis_id: true,
} as const;

/**
 * CUFD lifecycle per point of sale (SIAT-06).
 *
 * - `currentCufd(pos, at)` reads the CUFD valid at a given time. It never calls SIAT, so invoice
 *   emission (online or offline) does not wait on it.
 * - `ensureCufd` requests a new CUFD when the policy says so (`siat-cufd-policy.ts`).
 * - `renewDue` is the sweep run by `SiatCufdJob`, with a per-point-of-sale backoff after failures.
 * - A CUIS renewal (`siat.cuis.renewed`) triggers a new CUFD at once. If that event is lost, the
 *   `stale` state makes the next sweep do it.
 *
 * Rows are never updated or deleted: `siat_cufd` is the full history.
 */
@Injectable()
export class SiatCufdService {
  private readonly logger = new Logger(SiatCufdService.name);
  /** Consecutive sweep failures per point of sale. In memory: a restart retries at once. */
  private readonly backoff = new Map<
    string,
    { failures: number; nextAttemptAt: number }
  >();
  /** Points of sale already reported as having no valid CUFD (one event per outage). */
  private readonly unavailable = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SiatSoapClient,
    private readonly codes: SiatCodesService,
    private readonly events: EventEmitter2,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
    @Inject(SIAT_CLOCK) private readonly clock: SiatClock,
  ) {}

  /**
   * The CUFD valid at `at`: the most recently issued one whose validity covers that instant. After
   * a rotation two CUFDs overlap, and the newest wins. Offline emission (SIAT-17) passes the time
   * the invoice was issued, so it gets the CUFD that was valid then. No SIAT call.
   */
  async currentCufd(
    pointOfSaleId: string,
    at: Date,
  ): Promise<SiatCufdRecord | null> {
    const row = await this.prisma.siatCufd.findFirst({
      where: {
        point_of_sale_id: pointOfSaleId,
        valid_from: { lte: at },
        valid_until: { gt: at },
      },
      orderBy: { valid_from: 'desc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      pointOfSaleId: row.point_of_sale_id,
      codigo: row.codigo,
      codigoControl: row.codigo_control,
      direccion: row.direccion,
      codigoInterno: row.codigo_interno,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      cuisId: row.cuis_id,
    };
  }

  /** `currentCufd`, or 409 `SIAT_CUFD_UNAVAILABLE` when no CUFD is valid at `at`. */
  async requireCufd(pointOfSaleId: string, at: Date): Promise<SiatCufdRecord> {
    const cufd = await this.currentCufd(pointOfSaleId, at);
    if (!cufd) {
      throw new ConflictException({
        code: 'SIAT_CUFD_UNAVAILABLE',
        message: 'The point of sale has no valid CUFD',
      });
    }
    return cufd;
  }

  /** Stored CUFD status, with no SIAT call. */
  async status(pointOfSaleId: string): Promise<SiatCufdStatus> {
    const pos = await this.loadPointOfSale(pointOfSaleId);
    const { latest, state } = await this.stateOf(this.prisma, pos.id);
    return this.view(pos, state, latest, 'stored');
  }

  /**
   * Returns the stored CUFD while the policy says it is fine, and asks SIAT otherwise. If SIAT
   * fails while the stored CUFD is still usable, that CUFD is kept (`renewalFailed: true`).
   * With `force`, or when nothing usable is stored, the error is thrown.
   */
  async ensureCufd(
    pointOfSaleId: string,
    options: EnsureCufdOptions,
  ): Promise<SiatCufdStatus> {
    const pos = await this.loadPointOfSale(pointOfSaleId);
    if (pos.closed_at) {
      throw new ConflictException({
        code: 'SIAT_POS_CLOSED',
        message: 'The point of sale was closed in SIAT',
      });
    }
    const { latest, state } = await this.stateOf(this.prisma, pos.id);
    if (!options.force && !cufdNeedsRequest(state)) {
      return this.view(pos, state, latest, 'stored');
    }

    try {
      const status = await this.requestAndStore(pos, options);
      this.recordSuccess(pos.id);
      return status;
    } catch (error) {
      if (!options.force && cufdUsable(state)) {
        this.logger.warn(
          `CUFD request failed for PoS ${pos.id} (${state}), keeping the stored one: ${String(error)}`,
        );
        return {
          ...this.view(pos, state, latest, 'stored'),
          renewalFailed: true,
        };
      }
      throw error;
    }
  }

  /** A changed CUIS needs a new CUFD (annex). Never throws: the sweep catches what this misses. */
  @OnEvent(SIAT_CUIS_RENEWED_EVENT, { async: true })
  async onCuisRenewed(event: SiatCuisRenewedEvent): Promise<void> {
    try {
      const status = await this.ensureCufd(event.pointOfSaleId, {
        source: SiatCufdSource.ON_DEMAND,
        correlationId: `cuis-renewed-${event.pointOfSaleId}`,
      });
      if (status.renewalFailed) {
        this.recordFailure(event.pointOfSaleId);
      }
    } catch (error) {
      this.recordFailure(event.pointOfSaleId);
      this.logger.error(
        `CUFD after CUIS renewal failed for PoS ${event.pointOfSaleId}: ${String(error)}`,
      );
    }
  }

  /**
   * Sweep for the job. Every active, open point of sale of an active branch whose CUFD needs a
   * request gets one, unless it is waiting out its backoff after a failure. Does nothing while
   * `SIAT_ENABLED` is false. Never throws.
   */
  async renewDue(): Promise<{
    renewed: number;
    failed: number;
    deferred: number;
  }> {
    const summary = { renewed: 0, failed: 0, deferred: 0 };
    if (!(await this.codes.siatEnabled())) return summary;

    const points = await this.prisma.siatPointOfSale.findMany({
      where: { active: true, closed_at: null, branch: { active: true } },
      select: {
        id: true,
        codigo_punto_venta: true,
        closed_at: true,
        branch: { select: { codigo_sucursal: true } },
      },
    });
    for (const pos of points) {
      const label = `sucursal ${pos.branch.codigo_sucursal} / PoS ${pos.codigo_punto_venta}`;
      const { latest, state } = await this.stateOf(this.prisma, pos.id);
      if (!cufdNeedsRequest(state)) {
        this.recordSuccess(pos.id);
        continue;
      }
      const wait = this.backoff.get(pos.id);
      if (wait && wait.nextAttemptAt > this.clock.now().getTime()) {
        summary.deferred += 1;
        continue;
      }

      try {
        const status = await this.ensureCufd(pos.id, {
          source: SiatCufdSource.SCHEDULED,
        });
        if (status.renewalFailed) {
          summary.failed += 1;
          this.recordFailure(pos.id);
        } else if (status.source === 'siat') {
          summary.renewed += 1;
        }
      } catch (error) {
        summary.failed += 1;
        const failures = this.recordFailure(pos.id);
        this.logger.error(
          `CUFD request failed for ${label} (${state}, attempt ${failures}): ${String(error)}`,
        );
        if (!cufdUsable(state)) this.reportUnavailable(pos, latest, error);
      }
    }
    return summary;
  }

  private async requestAndStore(
    pos: PointOfSaleRef,
    options: EnsureCufdOptions,
  ): Promise<SiatCufdStatus> {
    // Obtain or renew the CUIS first, outside the transaction below: `cuisCode` takes its own row
    // lock on the same point of sale from another connection, which would deadlock inside it.
    await this.codes.cuisCode(pos.id, {
      userId: options.userId ?? null,
      correlationId: options.correlationId,
    });
    const identity = await this.codes.identity();

    // One SIAT request per point of sale at a time: concurrent callers (shift open, admin, job,
    // CUIS event) wait on the row lock, then find the CUFD the first one stored.
    const stored = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM siat.siat_points_of_sale WHERE id = ${pos.id}::uuid FOR UPDATE`;
        const { latest, state, cuis } = await this.stateOf(tx, pos.id);
        if (!options.force && !cufdNeedsRequest(state)) {
          return { kind: 'stored' as const, latest, state };
        }
        if (!cuis) {
          throw new ConflictException({
            code: 'SIAT_CUIS_UNAVAILABLE',
            message: 'The point of sale has no valid CUIS',
          });
        }

        const result = await this.client.invoke(
          SIAT_OPERATIONS.FacturacionCodigos.cufd,
          cufdRequest(
            identity,
            pos.branch.codigo_sucursal,
            pos.codigo_punto_venta,
            cuis.code,
          ),
          {
            pointOfSaleId: pos.id,
            correlationId: options.correlationId,
            metadata: { reason: options.force ? 'forced' : state },
          },
        );
        const issued = cufdResponse(result);
        if (!issued) throw new SiatRejectedError('cufd', result.mensajes);

        // Validity starts when the answer arrives: never claim a CUFD before SIAT issued it.
        const created = await tx.siatCufd.create({
          data: {
            point_of_sale_id: pos.id,
            codigo: issued.codigo,
            codigo_control: issued.codigoControl,
            direccion: issued.direccion,
            codigo_interno: issued.codigoInterno,
            valid_from: this.clock.now(),
            valid_until: issued.fechaVigencia,
            cuis_id: cuis.id,
            source: options.source,
          },
          select: CUFD_TIMES,
        });
        return { kind: 'issued' as const, latest: created };
      },
      // The transaction spans one SIAT call: allow the client's total timeout plus a margin.
      { maxWait: 10_000, timeout: this.config.totalTimeoutMs + 15_000 },
    );

    if (stored.kind === 'stored') {
      return this.view(pos, stored.state, stored.latest, 'stored');
    }
    this.logger.log(
      `CUFD issued for sucursal ${pos.branch.codigo_sucursal} / PoS ${pos.codigo_punto_venta} (${options.source}), valid until ${stored.latest.valid_until.toISOString()}`,
    );
    const state = cufdState(
      stored.latest,
      stored.latest.cuis_id,
      this.clock.now(),
      this.config,
    );
    return this.view(pos, state, stored.latest, 'siat');
  }

  /** Latest CUFD (by issue time), the active CUIS, and the resulting state. */
  private async stateOf(
    db: Pick<PrismaService, 'siatCufd' | 'siatCuis'>,
    pointOfSaleId: string,
  ): Promise<{
    latest: StoredCufd | null;
    cuis: { id: string; code: string } | null;
    state: SiatCufdState;
  }> {
    const [latest, cuis] = await Promise.all([
      db.siatCufd.findFirst({
        where: { point_of_sale_id: pointOfSaleId },
        orderBy: { valid_from: 'desc' },
        select: CUFD_TIMES,
      }),
      db.siatCuis.findFirst({
        where: { point_of_sale_id: pointOfSaleId, active: true },
        select: { id: true, code: true },
      }),
    ]);
    const state = cufdState(
      latest,
      cuis?.id ?? null,
      this.clock.now(),
      this.config,
    );
    return { latest, cuis, state };
  }

  private recordSuccess(pointOfSaleId: string): void {
    this.backoff.delete(pointOfSaleId);
    this.unavailable.delete(pointOfSaleId);
  }

  /** Counts a failure and schedules the next attempt. Returns the consecutive failure count. */
  private recordFailure(pointOfSaleId: string): number {
    const failures = (this.backoff.get(pointOfSaleId)?.failures ?? 0) + 1;
    this.backoff.set(pointOfSaleId, {
      failures,
      nextAttemptAt:
        this.clock.now().getTime() +
        cufdRetryDelayMs(failures, this.config.cufdRetryMaxMs),
    });
    return failures;
  }

  private reportUnavailable(
    pos: PointOfSaleRef,
    latest: StoredCufd | null,
    error: unknown,
  ): void {
    if (this.unavailable.has(pos.id)) return;
    this.unavailable.add(pos.id);
    const event: SiatCufdUnavailableEvent = {
      pointOfSaleId: pos.id,
      codigoSucursal: pos.branch.codigo_sucursal,
      codigoPuntoVenta: pos.codigo_punto_venta,
      expiredAt: latest?.valid_until ?? null,
      error: String(error),
    };
    this.logger.error(
      `No valid CUFD for sucursal ${event.codigoSucursal} / PoS ${event.codigoPuntoVenta}: invoices cannot be issued until SIAT answers`,
    );
    this.events.emit(SIAT_CUFD_UNAVAILABLE_EVENT, event);
  }

  private async loadPointOfSale(id: string): Promise<PointOfSaleRef> {
    const pos = await this.prisma.siatPointOfSale.findUnique({
      where: { id },
      select: {
        id: true,
        codigo_punto_venta: true,
        closed_at: true,
        branch: { select: { codigo_sucursal: true } },
      },
    });
    if (!pos) throw new NotFoundException('SIAT point of sale not found');
    return pos;
  }

  private view(
    pos: PointOfSaleRef,
    state: SiatCufdState,
    latest: StoredCufd | null,
    source: SiatCufdStatus['source'],
  ): SiatCufdStatus {
    const validUntil = latest?.valid_until ?? null;
    return {
      pointOfSaleId: pos.id,
      codigoSucursal: pos.branch.codigo_sucursal,
      codigoPuntoVenta: pos.codigo_punto_venta,
      state,
      validUntil,
      minutesLeft: cufdMinutesLeft(validUntil, this.clock.now()),
      source,
    };
  }
}
