import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ShiftStatus } from '@prisma/client';
import { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SIAT_OPERATIONS } from '../client/siat-operations';
import { SiatSoapClient } from '../client/siat-soap.client';
import { SIAT_CLOCK, type SiatClock } from '../codes/siat-clock';
import {
  verificarNitRequest,
  verificarNitResponse,
} from '../codes/siat-codes.payloads';
import { SiatCodesService } from '../codes/siat-codes.service';
import { isSpecialBuyerNumber } from './siat-buyer-rules';

/** A valid answer is reused for 24 h (ticket rule). */
export const NIT_VALID_TTL_MS = 24 * 60 * 60 * 1000;
/** A failed answer backs a `codigoExcepcion` confirmation only for this long. */
export const NIT_INVALID_TTL_MS = 30 * 60 * 1000;

const MAX_NIT_LENGTH = 20;

export interface NitVerificationResult {
  nit: string;
  valid: boolean;
  /** True when the answer came from the 24 h cache, with no SIAT call. */
  cached: boolean;
  verifiedAt: Date;
  codigoEstado: number | null;
  messages: { codigo: number; descripcion: string }[];
}

/**
 * `verificarNit` for buyers (SIAT-10). Only NITs are ever sent: CI, CEX, PAS and OD numbers are
 * not verifiable and never reach SIAT.
 *
 * The request uses the CUIS of the caller's open-shift point of sale and the code of its branch.
 * Valid answers are cached for 24 h. A failed answer is stored, but never served as a cache hit:
 * it only lets `resolve` accept an explicit `codigoExcepcion` confirmation shortly after.
 */
@Injectable()
export class SiatNitVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SiatSoapClient,
    private readonly codes: SiatCodesService,
    private readonly audit: AuditLogRepository,
    @Inject(SIAT_CLOCK) private readonly clock: SiatClock,
  ) {}

  async verify(rawNit: string, userId: string): Promise<NitVerificationResult> {
    const nit = normalizeNit(rawNit);

    const stored = await this.prisma.siatNitVerification.findUnique({
      where: { nit },
    });
    const now = this.clock.now();
    if (stored?.valid && isFresh(stored.verified_at, now, NIT_VALID_TTL_MS)) {
      return {
        nit,
        valid: true,
        cached: true,
        verifiedAt: stored.verified_at,
        codigoEstado: stored.codigo_estado,
        messages: parseMessages(stored.messages),
      };
    }

    const pos = await this.openShiftPointOfSale(userId);
    const [identity, cuis] = await Promise.all([
      this.codes.identity(),
      this.codes.cuisCode(pos.id, { userId }),
    ]);
    const result = await this.client.invoke(
      SIAT_OPERATIONS.FacturacionCodigos.verificarNit,
      verificarNitRequest(identity, pos.branch.codigo_sucursal, cuis, nit),
      { pointOfSaleId: pos.id, metadata: { purpose: 'buyer-nit' } },
    );
    const check = verificarNitResponse(result);
    const verifiedAt = this.clock.now();

    const data = {
      valid: check.valid,
      codigo_estado: check.codigoEstado,
      messages: check.messages as unknown as Prisma.InputJsonValue,
      verified_at: verifiedAt,
    };
    await this.prisma.siatNitVerification.upsert({
      where: { nit },
      create: { nit, ...data },
      update: data,
    });
    await this.audit.create({
      userId,
      event: 'SIAT_NIT_VERIFIED',
      metadata: {
        nit,
        valid: check.valid,
        codigoEstado: check.codigoEstado,
        codes: check.messages.map((m) => m.codigo),
        pointOfSaleId: pos.id,
      },
    });

    return { nit, cached: false, verifiedAt, ...check };
  }

  /**
   * The stored answer that `resolve` may rely on, with no SIAT call: a valid one within 24 h,
   * or a failed one within 30 minutes. Null otherwise.
   */
  async lastCheck(rawNit: string): Promise<{ valid: boolean } | null> {
    const nit = rawNit.trim();
    const stored = await this.prisma.siatNitVerification.findUnique({
      where: { nit },
      select: { valid: true, verified_at: true },
    });
    if (!stored) return null;
    const ttl = stored.valid ? NIT_VALID_TTL_MS : NIT_INVALID_TTL_MS;
    return isFresh(stored.verified_at, this.clock.now(), ttl)
      ? { valid: stored.valid }
      : null;
  }

  private async openShiftPointOfSale(userId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { user_id: userId, status: ShiftStatus.OPEN },
      select: {
        point_of_sale: {
          select: { id: true, branch: { select: { codigo_sucursal: true } } },
        },
      },
    });
    if (!shift) {
      throw new ConflictException({
        code: 'SHIFT_NOT_OPEN',
        message: 'Open a shift before verifying a NIT',
      });
    }
    if (!shift.point_of_sale) {
      throw new ConflictException({
        code: 'SIAT_SHIFT_WITHOUT_POS',
        message: 'The open shift has no SIAT point of sale',
      });
    }
    return shift.point_of_sale;
  }
}

/** Digits only, not 0 and not a special code. Those are never verifiable in SIAT. */
function normalizeNit(raw: string): string {
  const nit = typeof raw === 'string' ? raw.trim() : '';
  if (
    !/^\d+$/.test(nit) ||
    nit.length > MAX_NIT_LENGTH ||
    /^0+$/.test(nit) ||
    isSpecialBuyerNumber(nit)
  ) {
    throw new UnprocessableEntityException({
      code: 'SIAT_NIT_FORMAT',
      message: `A NIT is 1 to ${MAX_NIT_LENGTH} digits, not 0 and not a special code`,
    });
  }
  return nit;
}

function isFresh(at: Date, now: Date, ttlMs: number): boolean {
  const age = now.getTime() - at.getTime();
  return age >= 0 && age < ttlMs;
}

function parseMessages(raw: unknown): NitVerificationResult['messages'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { codigo: number; descripcion: string } =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as { codigo?: unknown }).codigo === 'number',
    )
    .map((m) => ({ codigo: m.codigo, descripcion: String(m.descripcion) }));
}
