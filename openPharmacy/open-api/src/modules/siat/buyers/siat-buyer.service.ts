import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import { SiatCatalogsService } from '../catalogs/siat-catalogs.service';
import {
  SIAT_DOC_TYPE,
  SiatBuyerRuleError,
  isSpecialBuyerNumber,
  resolveBuyer,
  toCents,
  type BuyerInput,
  type ResolvedBuyer,
} from './siat-buyer-rules';
import { SiatNitVerificationService } from './siat-nit-verification.service';

export type NitCheckState = 'VALID' | 'INVALID' | 'UNCHECKED';

export interface ResolveBuyerRequest {
  buyer?: BuyerInput | null;
  /** Invoice total in bolivianos. */
  total: number | string;
  confirmInvalidNit?: boolean;
}

export interface ResolveBuyerResponse extends ResolvedBuyer {
  /** Stored `verificarNit` state for a NIT buyer. Null for any other buyer. */
  nitCheck: NitCheckState | null;
}

/**
 * Applies the buyer rules (SIAT-10) with the data they need: the active document types and the
 * stored NIT check. Never calls SIAT: a NIT is verified separately with `verify-nit`.
 */
@Injectable()
export class SiatBuyerService {
  constructor(
    private readonly catalogs: SiatCatalogsService,
    private readonly nits: SiatNitVerificationService,
    private readonly audit: AuditLogRepository,
  ) {}

  async resolve(
    request: ResolveBuyerRequest,
    role: UserRole,
  ): Promise<ResolveBuyerResponse> {
    const activeDocTypes = await this.activeDocTypes();
    const nitNumber = verifiableNit(request.buyer);
    const stored = nitNumber ? await this.nits.lastCheck(nitNumber) : null;

    try {
      const resolved = resolveBuyer({
        buyer: request.buyer,
        totalCents: toCents(request.total),
        role,
        activeDocTypes,
        nitCheck: stored,
        confirmInvalidNit: request.confirmInvalidNit === true,
      });
      const isNit =
        resolved.kind === 'IDENTIFIED' &&
        resolved.docType === SIAT_DOC_TYPE.NIT;
      return {
        ...resolved,
        nitCheck: isNit ? nitState(stored) : null,
      };
    } catch (error) {
      throw toHttp(error);
    }
  }

  /**
   * Audits a `codigoExcepcion = 1` invoice, with user and sale, inside the transaction that
   * creates it (SIAT-14). Call it only for a buyer whose `codigoExcepcion` is 1.
   */
  async recordExceptionUse(
    tx: Prisma.TransactionClient,
    record: {
      userId: string;
      saleId: string;
      invoiceId?: string;
      buyer: Pick<ResolvedBuyer, 'docNumber' | 'codigoExcepcion'>;
    },
  ): Promise<void> {
    if (record.buyer.codigoExcepcion !== 1) return;
    await this.audit.createInTx(tx, {
      userId: record.userId,
      event: 'SIAT_CODIGO_EXCEPCION_USED',
      metadata: {
        saleId: record.saleId,
        ...(record.invoiceId ? { invoiceId: record.invoiceId } : {}),
        nit: record.buyer.docNumber,
        codigoExcepcion: 1,
      },
    });
  }

  private async activeDocTypes(): Promise<Set<number>> {
    const codes = await this.catalogs.activeCodeSet('document-types');
    const types = new Set(
      [...codes].map(Number).filter((code) => Number.isInteger(code)),
    );
    if (types.size === 0) {
      throw new ConflictException({
        code: 'SIAT_CATALOG_NOT_SYNCED',
        message: 'The SIN document types have not been synchronized yet',
      });
    }
    return types;
  }
}

/** The NIT whose stored check matters: NIT type, digits, not 0 and not a special code. */
function verifiableNit(buyer: BuyerInput | null | undefined): string | null {
  if (buyer?.docType !== SIAT_DOC_TYPE.NIT) return null;
  const nit = buyer.docNumber?.trim() ?? '';
  if (!/^\d+$/.test(nit) || /^0+$/.test(nit) || isSpecialBuyerNumber(nit)) {
    return null;
  }
  return nit;
}

function nitState(stored: { valid: boolean } | null): NitCheckState {
  if (!stored) return 'UNCHECKED';
  return stored.valid ? 'VALID' : 'INVALID';
}

function toHttp(error: unknown): unknown {
  if (!(error instanceof SiatBuyerRuleError)) return error;
  const body = { code: error.code, message: error.message };
  return error.forbidden
    ? new ForbiddenException(body)
    : new UnprocessableEntityException(body);
}
