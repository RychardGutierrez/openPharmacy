import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService as PharmacyConfigService } from '../../config/config.service';
import { SiatRejectedError } from '../client/siat-errors';
import { SIAT_OPERATIONS } from '../client/siat-operations';
import { SiatSoapClient } from '../client/siat-soap.client';
import {
  SIAT_CREDENTIALS,
  type SiatCredentialsSource,
} from '../config/siat-credentials';
import { SIAT_CONFIG, type SiatConfig } from '../config/siat.config';
import { SIAT_CLOCK, type SiatClock } from './siat-clock';
import {
  cuisRequest,
  cuisResponse,
  type SiatIdentity,
} from './siat-codes.payloads';
import {
  cuisDaysLeft,
  cuisNeedsRequest,
  cuisState,
  cuisUsable,
  type SiatCuisState,
} from './siat-cuis-policy';

/** Emitted after a CUIS changed for a point of sale. SIAT-06 must then request a new CUFD. */
export const SIAT_CUIS_RENEWED_EVENT = 'siat.cuis.renewed';

export interface SiatCuisRenewedEvent {
  pointOfSaleId: string;
  codigoSucursal: number;
  codigoPuntoVenta: number;
  validUntil: Date;
}

/** CUIS status for one point of sale. Never contains the CUIS code. */
export interface SiatCuisStatus {
  pointOfSaleId: string;
  codigoSucursal: number;
  codigoPuntoVenta: number;
  state: SiatCuisState;
  validUntil: Date | null;
  daysLeft: number | null;
  /** `stored`: no SIAT call was needed. `siat`: SIAT was asked in this call. */
  source: 'stored' | 'siat';
  /** A new code replaced the previous one (invoice numbering restarts, a new CUFD is needed). */
  renewed: boolean;
  /** SIAT failed, but the stored CUIS is still usable, so it was kept. */
  renewalFailed?: boolean;
}

export interface EnsureCuisOptions {
  /** Ask SIAT even when the stored CUIS is outside the renewal window. Errors are thrown. */
  force?: boolean;
  /** User behind the request, for the audit row. Null for the renewal job. */
  userId?: string | null;
  correlationId?: string;
}

type PointOfSaleWithCuis = {
  id: string;
  codigo_punto_venta: number;
  closed_at: Date | null;
  branch: { codigo_sucursal: number };
  cuis: Array<{ id: string; code: string; valid_until: Date }>;
};

/** Computarizada en Línea (decision D1). */
const DEFAULT_MODALITY = 2;

/**
 * CUIS lifecycle per point of sale (SIAT-05).
 *
 * `ensureCuis` returns the stored CUIS while it is outside the renewal window, and asks SIAT
 * otherwise. SIAT answers "CUIS vigente" with the current code when one is still valid, so any
 * response that carries a `codigo` is stored, whatever `transaccion` says. That also makes a
 * timed-out request self-healing: the next call gets the same code back.
 */
@Injectable()
export class SiatCodesService {
  private readonly logger = new Logger(SiatCodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SiatSoapClient,
    private readonly settings: PharmacyConfigService,
    private readonly audit: AuditLogRepository,
    private readonly events: EventEmitter2,
    @Inject(SIAT_CONFIG) private readonly config: SiatConfig,
    @Inject(SIAT_CREDENTIALS)
    private readonly credentials: SiatCredentialsSource,
    @Inject(SIAT_CLOCK) private readonly clock: SiatClock,
  ) {}

  async ensureCuis(
    pointOfSaleId: string,
    options: EnsureCuisOptions = {},
  ): Promise<SiatCuisStatus> {
    return (await this.ensure(pointOfSaleId, options)).status;
  }

  /** The usable CUIS code of a point of sale, obtained or renewed when needed. Internal use only. */
  async cuisCode(
    pointOfSaleId: string,
    options: EnsureCuisOptions = {},
  ): Promise<string> {
    const { code, status } = await this.ensure(pointOfSaleId, options);
    if (!code || !cuisUsable(status.state)) {
      throw new ConflictException({
        code: 'SIAT_CUIS_UNAVAILABLE',
        message: 'The point of sale has no valid CUIS',
      });
    }
    return code;
  }

  /** Stored CUIS status, with no SIAT call. */
  async status(pointOfSaleId: string): Promise<SiatCuisStatus> {
    const pos = await this.loadPointOfSale(pointOfSaleId);
    const active = pos.cuis[0];
    return this.view(pos, active?.valid_until ?? null, 'stored', false);
  }

  /**
   * Renewal sweep for the job: every active, open point of sale whose CUIS is missing, expired or
   * in the renewal window is renewed; those in the alert window are logged. Does nothing while
   * `SIAT_ENABLED` is false. Never throws.
   */
  async renewDue(): Promise<{
    renewed: number;
    alerts: number;
    failed: number;
  }> {
    const summary = { renewed: 0, alerts: 0, failed: 0 };
    if (!(await this.siatEnabled())) return summary;

    const points = await this.prisma.siatPointOfSale.findMany({
      where: { active: true, closed_at: null, branch: { active: true } },
      select: {
        id: true,
        codigo_punto_venta: true,
        branch: { select: { codigo_sucursal: true } },
        cuis: {
          where: { active: true },
          select: { valid_until: true },
          take: 1,
        },
      },
    });
    const now = this.clock.now();
    for (const pos of points) {
      const validUntil = pos.cuis[0]?.valid_until;
      const state = cuisState(validUntil, now, this.config);
      const label = `sucursal ${pos.branch.codigo_sucursal} / PoS ${pos.codigo_punto_venta}`;
      if (state === 'alert') {
        summary.alerts += 1;
        this.logger.warn(
          `CUIS for ${label} expires in ${cuisDaysLeft(validUntil, now)} days; renewal starts ${this.config.cuisRenewDays} days before`,
        );
        continue;
      }
      if (!cuisNeedsRequest(state)) continue;
      try {
        const { status } = await this.ensure(pos.id, { userId: null });
        if (status.renewalFailed) summary.failed += 1;
        else if (status.source === 'siat') summary.renewed += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.error(`CUIS renewal failed for ${label}: ${String(error)}`);
      }
    }
    return summary;
  }

  /** NIT, código de sistema and modality, or 409 when the SIAT settings are incomplete. */
  async identity(): Promise<SiatIdentity> {
    const [credentials, stored] = await Promise.all([
      this.credentials.resolve(),
      this.settings.getStoredValues(['SIAT_MODALITY']),
    ]);
    const missing = [
      !credentials.token && 'token',
      !/^\d+$/.test(credentials.nit) && 'nit',
      !credentials.codigoSistema && 'systemCode',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new ConflictException({
        code: 'SIAT_NOT_CONFIGURED',
        message: 'Complete the SIAT settings before calling SIAT',
        missing,
      });
    }
    return {
      nit: credentials.nit,
      codigoSistema: credentials.codigoSistema,
      codigoModalidad:
        typeof stored.SIAT_MODALITY === 'number'
          ? stored.SIAT_MODALITY
          : DEFAULT_MODALITY,
    };
  }

  async siatEnabled(): Promise<boolean> {
    const stored = await this.settings.getStoredValues(['SIAT_ENABLED']);
    return stored.SIAT_ENABLED === true;
  }

  private async ensure(
    pointOfSaleId: string,
    options: EnsureCuisOptions,
  ): Promise<{ status: SiatCuisStatus; code: string | null }> {
    const pos = await this.loadPointOfSale(pointOfSaleId);
    if (pos.closed_at) {
      throw new ConflictException({
        code: 'SIAT_POS_CLOSED',
        message: 'The point of sale was closed in SIAT',
      });
    }
    const active = pos.cuis[0];
    const state = cuisState(active?.valid_until, this.clock.now(), this.config);
    if (!options.force && !cuisNeedsRequest(state)) {
      return {
        status: this.view(pos, active.valid_until, 'stored', false),
        code: active.code,
      };
    }

    try {
      return await this.requestAndStore(pos, options);
    } catch (error) {
      // Keep operating with a CUIS that is still valid; the job retries later.
      if (!options.force && active && cuisUsable(state)) {
        this.logger.warn(
          `CUIS request failed for PoS ${pos.id}, keeping the stored one: ${String(error)}`,
        );
        return {
          status: {
            ...this.view(pos, active.valid_until, 'stored', false),
            renewalFailed: true,
          },
          code: active.code,
        };
      }
      throw error;
    }
  }

  private async requestAndStore(
    pos: PointOfSaleWithCuis,
    options: EnsureCuisOptions,
  ): Promise<{ status: SiatCuisStatus; code: string }> {
    const identity = await this.identity();

    // One SIAT request per point of sale at a time: the row lock serializes concurrent callers
    // (shift open, admin, job), and the second one sees the CUIS the first one stored.
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM siat.siat_points_of_sale WHERE id = ${pos.id}::uuid FOR UPDATE`;
        const current = await tx.siatCuis.findFirst({
          where: { point_of_sale_id: pos.id, active: true },
          select: { id: true, code: true, valid_until: true },
        });
        const now = this.clock.now();
        const state = cuisState(current?.valid_until, now, this.config);
        if (current && !options.force && !cuisNeedsRequest(state)) {
          return {
            kind: 'stored' as const,
            code: current.code,
            validUntil: current.valid_until,
          };
        }

        const result = await this.client.invoke(
          SIAT_OPERATIONS.FacturacionCodigos.cuis,
          cuisRequest(
            identity,
            pos.branch.codigo_sucursal,
            pos.codigo_punto_venta,
          ),
          {
            pointOfSaleId: pos.id,
            correlationId: options.correlationId,
            metadata: { reason: current ? state : 'missing' },
          },
        );
        const issued = cuisResponse(result);
        if (!issued) throw new SiatRejectedError('cuis', result.mensajes);

        if (current && current.code === issued.codigo) {
          // "CUIS vigente": same code. Keep it, with the validity SIAT reports.
          await tx.siatCuis.update({
            where: { id: current.id },
            data: { valid_until: issued.fechaVigencia },
          });
          return {
            kind: 'same' as const,
            code: issued.codigo,
            validUntil: issued.fechaVigencia,
          };
        }
        if (current) {
          await tx.siatCuis.update({
            where: { id: current.id },
            data: { active: false },
          });
        }
        await tx.siatCuis.create({
          data: {
            point_of_sale_id: pos.id,
            code: issued.codigo,
            valid_until: issued.fechaVigencia,
            requested_at: now,
          },
        });
        return {
          kind: current ? ('renewed' as const) : ('obtained' as const),
          code: issued.codigo,
          validUntil: issued.fechaVigencia,
        };
      },
      // The transaction spans one SIAT call: allow the client's total timeout plus a margin.
      { maxWait: 10_000, timeout: this.config.totalTimeoutMs + 15_000 },
    );

    const renewed = outcome.kind === 'renewed';
    const status = this.view(
      pos,
      outcome.validUntil,
      outcome.kind === 'stored' ? 'stored' : 'siat',
      renewed,
    );
    if (outcome.kind === 'obtained' || outcome.kind === 'renewed') {
      await this.audit.create({
        userId: options.userId ?? null,
        event: renewed ? 'SIAT_CUIS_RENEWED' : 'SIAT_CUIS_OBTAINED',
        metadata: {
          pointOfSaleId: pos.id,
          codigoSucursal: pos.branch.codigo_sucursal,
          codigoPuntoVenta: pos.codigo_punto_venta,
          validUntil: outcome.validUntil.toISOString(),
        },
      });
      if (renewed) {
        const event: SiatCuisRenewedEvent = {
          pointOfSaleId: pos.id,
          codigoSucursal: pos.branch.codigo_sucursal,
          codigoPuntoVenta: pos.codigo_punto_venta,
          validUntil: outcome.validUntil,
        };
        this.events.emit(SIAT_CUIS_RENEWED_EVENT, event);
      }
    }
    return { status, code: outcome.code };
  }

  private async loadPointOfSale(id: string): Promise<PointOfSaleWithCuis> {
    const pos = await this.prisma.siatPointOfSale.findUnique({
      where: { id },
      select: {
        id: true,
        codigo_punto_venta: true,
        closed_at: true,
        branch: { select: { codigo_sucursal: true } },
        cuis: {
          where: { active: true },
          select: { id: true, code: true, valid_until: true },
          take: 1,
        },
      },
    });
    if (!pos) throw new NotFoundException('SIAT point of sale not found');
    return pos;
  }

  private view(
    pos: Pick<PointOfSaleWithCuis, 'id' | 'codigo_punto_venta' | 'branch'>,
    validUntil: Date | null,
    source: SiatCuisStatus['source'],
    renewed: boolean,
  ): SiatCuisStatus {
    const now = this.clock.now();
    return {
      pointOfSaleId: pos.id,
      codigoSucursal: pos.branch.codigo_sucursal,
      codigoPuntoVenta: pos.codigo_punto_venta,
      state: cuisState(validUntil, now, this.config),
      validUntil,
      daysLeft: cuisDaysLeft(validUntil, now),
      source,
      renewed,
    };
  }
}
