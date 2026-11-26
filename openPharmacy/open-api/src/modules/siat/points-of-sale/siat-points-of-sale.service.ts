import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ShiftStatus,
  SiatCufdSource,
  type SiatPointOfSale,
} from '@prisma/client';
import { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SiatRejectedError } from '../client/siat-errors';
import { SIAT_OPERATIONS } from '../client/siat-operations';
import { SiatSoapClient } from '../client/siat-soap.client';
import { SIAT_CLOCK, type SiatClock } from '../codes/siat-clock';
import {
  cierrePuntoVentaRequest,
  consultaPuntoVentaRequest,
  consultaPuntoVentaResponse,
  registroPuntoVentaRequest,
  registroPuntoVentaResponse,
  type SiatRemotePointOfSale,
} from '../codes/siat-codes.payloads';
import {
  SiatCodesService,
  type SiatCuisStatus,
} from '../codes/siat-codes.service';
import {
  SiatCufdService,
  type SiatCufdStatus,
} from '../codes/siat-cufd.service';
import {
  isKnownPointOfSaleType,
  PROVISIONAL_POINT_OF_SALE_TYPES,
} from '../codes/siat-point-of-sale-types';
import type {
  CreateSiatBranchDto,
  RegisterSiatPointOfSaleDto,
  UpdateSiatBranchDto,
  UpdateSiatPointOfSaleDto,
} from './dto/siat-points-of-sale.dto';

/** Point of sale 0 belongs to the branch itself: it exists without `registroPuntoVenta`. */
const BRANCH_POINT_OF_SALE = 0;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'P2002';

export interface SiatPointOfSaleView {
  id: string;
  branchId: string;
  codigoSucursal: number;
  codigoPuntoVenta: number;
  tipoPuntoVenta: number | null;
  name: string;
  active: boolean;
  closedAt: Date | null;
  openShifts: number;
  cuis: Pick<SiatCuisStatus, 'state' | 'validUntil' | 'daysLeft'>;
  cufd: Pick<SiatCufdStatus, 'state' | 'validUntil' | 'minutesLeft'>;
}

export interface SiatReconciliation {
  codigoSucursal: number;
  /** Registered in SIAT and stored here. */
  matched: Array<{
    codigoPuntoVenta: number;
    name: string;
    remoteName: string;
  }>;
  /** Registered in SIAT but unknown here (registered elsewhere, or a lost response). */
  remoteOnly: SiatRemotePointOfSale[];
  /** Stored here (not closed) but not reported by SIAT. Point of sale 0 is never reported. */
  localOnly: Array<{ id: string; codigoPuntoVenta: number; name: string }>;
}

/**
 * Branches and points of sale (SIAT-05). Registration, query and closure go through the
 * FacturacionOperaciones service, and all three need the **branch CUIS** (point of sale 0).
 */
@Injectable()
export class SiatPointsOfSaleService {
  private readonly logger = new Logger(SiatPointsOfSaleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SiatSoapClient,
    private readonly codes: SiatCodesService,
    private readonly cufd: SiatCufdService,
    private readonly audit: AuditLogRepository,
    @Inject(SIAT_CLOCK) private readonly clock: SiatClock,
  ) {}

  types() {
    return PROVISIONAL_POINT_OF_SALE_TYPES;
  }

  // ─── Branches ────────────────────────────────────────────────────────────

  listBranches() {
    return this.prisma.siatBranch.findMany({
      orderBy: { codigo_sucursal: 'asc' },
    });
  }

  /** Creates the branch and its point of sale 0. Nothing is sent to SIAT: branches live in the Padrón. */
  async createBranch(dto: CreateSiatBranchDto, userId: string) {
    try {
      const branch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.siatBranch.create({
          data: {
            codigo_sucursal: dto.codigoSucursal,
            name: dto.name.trim(),
            address: dto.address.trim(),
            municipality: dto.municipality.trim(),
            phone: dto.phone?.trim() || null,
          },
        });
        await tx.siatPointOfSale.create({
          data: {
            branch_id: created.id,
            codigo_punto_venta: BRANCH_POINT_OF_SALE,
            tipo_punto_venta: null,
            name: `${created.name} - punto de venta 0`,
          },
        });
        return created;
      });
      await this.audit.create({
        userId,
        event: 'SIAT_BRANCH_CREATED',
        metadata: {
          branchId: branch.id,
          codigoSucursal: branch.codigo_sucursal,
        },
      });
      return branch;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'SIAT_BRANCH_EXISTS',
          message: `Branch ${dto.codigoSucursal} already exists`,
        });
      }
      throw error;
    }
  }

  async updateBranch(id: string, dto: UpdateSiatBranchDto, userId: string) {
    await this.findBranch(id);
    if (dto.active === false) {
      const open = await this.prisma.shift.count({
        where: { status: ShiftStatus.OPEN, point_of_sale: { branch_id: id } },
      });
      if (open > 0) {
        throw new ConflictException({
          code: 'SIAT_BRANCH_HAS_OPEN_SHIFTS',
          message: 'Close the open shifts of this branch first',
        });
      }
    }
    const branch = await this.prisma.siatBranch.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        address: dto.address?.trim(),
        municipality: dto.municipality?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        active: dto.active,
      },
    });
    await this.audit.create({
      userId,
      event: 'SIAT_BRANCH_UPDATED',
      metadata: { branchId: id, fields: Object.keys(dto) },
    });
    return branch;
  }

  // ─── Points of sale ──────────────────────────────────────────────────────

  async list(): Promise<SiatPointOfSaleView[]> {
    const rows = await this.prisma.siatPointOfSale.findMany({
      orderBy: [
        { branch: { codigo_sucursal: 'asc' } },
        { codigo_punto_venta: 'asc' },
      ],
      include: {
        branch: { select: { codigo_sucursal: true } },
        _count: { select: { shifts: { where: { status: ShiftStatus.OPEN } } } },
      },
    });
    return Promise.all(
      rows.map(async (row) => {
        const [cuis, cufd] = await Promise.all([
          this.codes.status(row.id),
          this.cufd.status(row.id),
        ]);
        return {
          id: row.id,
          branchId: row.branch_id,
          codigoSucursal: row.branch.codigo_sucursal,
          codigoPuntoVenta: row.codigo_punto_venta,
          tipoPuntoVenta: row.tipo_punto_venta,
          name: row.name,
          active: row.active,
          closedAt: row.closed_at,
          openShifts: row._count.shifts,
          cuis: {
            state: cuis.state,
            validUntil: cuis.validUntil,
            daysLeft: cuis.daysLeft,
          },
          cufd: {
            state: cufd.state,
            validUntil: cufd.validUntil,
            minutesLeft: cufd.minutesLeft,
          },
        };
      }),
    );
  }

  /**
   * `registroPuntoVenta`, then a CUIS for the new point of sale. The point of sale is stored as soon
   * as SIAT assigns its number; a CUIS failure after that is reported, not rolled back (the SIN
   * already has the point of sale). Retry the CUIS with `POST :id/cuis`.
   */
  async register(dto: RegisterSiatPointOfSaleDto, userId: string) {
    if (!isKnownPointOfSaleType(dto.codigoTipoPuntoVenta)) {
      throw new BadRequestException({
        code: 'SIAT_POS_TYPE_UNKNOWN',
        message: `Unknown codigoTipoPuntoVenta ${dto.codigoTipoPuntoVenta}`,
      });
    }
    const branch = await this.findBranch(dto.branchId);
    if (!branch.active) {
      throw new ConflictException({
        code: 'SIAT_BRANCH_INACTIVE',
        message: 'The branch is inactive',
      });
    }
    const branchCuis = await this.branchCuis(branch.id, userId);
    const identity = await this.codes.identity();

    const result = await this.client.invoke(
      SIAT_OPERATIONS.FacturacionOperaciones.registroPuntoVenta,
      registroPuntoVentaRequest(identity, {
        codigoSucursal: branch.codigo_sucursal,
        codigoTipoPuntoVenta: dto.codigoTipoPuntoVenta,
        cuis: branchCuis,
        descripcion: dto.description.trim(),
        nombrePuntoVenta: dto.name.trim(),
      }),
      { metadata: { branchId: branch.id } },
    );
    const codigoPuntoVenta = registroPuntoVentaResponse(result);
    if (!result.transaccion || codigoPuntoVenta === null) {
      throw new SiatRejectedError('registroPuntoVenta', result.mensajes);
    }

    let pointOfSale: SiatPointOfSale;
    try {
      pointOfSale = await this.prisma.siatPointOfSale.create({
        data: {
          branch_id: branch.id,
          codigo_punto_venta: codigoPuntoVenta,
          tipo_punto_venta: dto.codigoTipoPuntoVenta,
          name: dto.name.trim(),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // SIAT never reuses numbers, so this means our data is out of sync with SIAT.
        this.logger.error(
          `registroPuntoVenta returned ${codigoPuntoVenta} for sucursal ${branch.codigo_sucursal}, which is already stored`,
        );
        throw new ConflictException({
          code: 'SIAT_POS_OUT_OF_SYNC',
          message: `SIAT assigned point of sale ${codigoPuntoVenta}, which already exists here. Run the reconciliation.`,
        });
      }
      throw error;
    }
    await this.audit.create({
      userId,
      event: 'SIAT_POS_REGISTERED',
      metadata: {
        pointOfSaleId: pointOfSale.id,
        codigoSucursal: branch.codigo_sucursal,
        codigoPuntoVenta,
        codigoTipoPuntoVenta: dto.codigoTipoPuntoVenta,
      },
    });

    let cuis: SiatCuisStatus | { state: 'missing'; error: string };
    try {
      cuis = await this.codes.ensureCuis(pointOfSale.id, { userId });
    } catch (error) {
      this.logger.warn(
        `CUIS for new PoS ${pointOfSale.id} failed: ${String(error)}`,
      );
      cuis = {
        state: 'missing',
        error: error instanceof Error ? error.name : 'Error',
      };
    }
    return { pointOfSale, cuis };
  }

  async update(id: string, dto: UpdateSiatPointOfSaleDto, userId: string) {
    const pos = await this.findPointOfSale(id);
    if (pos.closed_at && dto.active === true) {
      throw new ConflictException({
        code: 'SIAT_POS_CLOSED',
        message: 'A closed point of sale cannot be reactivated',
      });
    }
    if (dto.active === false) await this.assertNoOpenShifts(id);
    const updated = await this.prisma.siatPointOfSale.update({
      where: { id },
      data: { name: dto.name?.trim(), active: dto.active },
    });
    await this.audit.create({
      userId,
      event: 'SIAT_POS_UPDATED',
      metadata: {
        pointOfSaleId: id,
        fields: Object.keys(dto),
        active: updated.active,
      },
    });
    return updated;
  }

  ensureCuis(id: string, force: boolean, userId: string) {
    return this.codes.ensureCuis(id, { force, userId });
  }

  /**
   * Gets a CUFD when the stored one needs renewal, or always with `force` (operations, and the
   * repeated CUFD requests of Fase I). A newly issued CUFD is audited; its codes are not.
   */
  async ensureCufd(id: string, force: boolean, userId: string) {
    const status = await this.cufd.ensureCufd(id, {
      source: SiatCufdSource.ON_DEMAND,
      force,
      userId,
    });
    if (status.source === 'siat') {
      await this.audit.create({
        userId,
        event: 'SIAT_CUFD_REQUESTED',
        metadata: {
          pointOfSaleId: id,
          codigoSucursal: status.codigoSucursal,
          codigoPuntoVenta: status.codigoPuntoVenta,
          forced: force,
          validUntil: status.validUntil?.toISOString() ?? null,
        },
      });
    }
    return status;
  }

  /** `consultaPuntoVenta` for one branch, compared with the stored points of sale. Changes nothing. */
  async reconcile(branchId: string): Promise<SiatReconciliation> {
    const branch = await this.findBranch(branchId);
    const branchCuis = await this.branchCuis(branch.id, null);
    const identity = await this.codes.identity();
    const result = await this.client.invoke(
      SIAT_OPERATIONS.FacturacionOperaciones.consultaPuntoVenta,
      consultaPuntoVentaRequest(identity, branch.codigo_sucursal, branchCuis),
      { metadata: { branchId } },
    );
    const remote = consultaPuntoVentaResponse(result);
    if (
      !result.transaccion &&
      remote.length === 0 &&
      result.mensajes.length > 0
    ) {
      throw new SiatRejectedError('consultaPuntoVenta', result.mensajes);
    }

    const local = await this.prisma.siatPointOfSale.findMany({
      where: { branch_id: branchId, closed_at: null },
      select: { id: true, codigo_punto_venta: true, name: true },
    });
    const localByCode = new Map(
      local.map((pos) => [pos.codigo_punto_venta, pos]),
    );
    const remoteCodes = new Set(remote.map((pos) => pos.codigoPuntoVenta));

    return {
      codigoSucursal: branch.codigo_sucursal,
      matched: remote
        .filter((pos) => localByCode.has(pos.codigoPuntoVenta))
        .map((pos) => ({
          codigoPuntoVenta: pos.codigoPuntoVenta,
          name: localByCode.get(pos.codigoPuntoVenta)!.name,
          remoteName: pos.nombrePuntoVenta,
        })),
      remoteOnly: remote.filter(
        (pos) => !localByCode.has(pos.codigoPuntoVenta),
      ),
      localOnly: local
        .filter(
          (pos) =>
            pos.codigo_punto_venta !== BRANCH_POINT_OF_SALE &&
            !remoteCodes.has(pos.codigo_punto_venta),
        )
        .map((pos) => ({
          id: pos.id,
          codigoPuntoVenta: pos.codigo_punto_venta,
          name: pos.name,
        })),
    };
  }

  /**
   * `cierrePuntoVenta`. Final: the SIN never reuses the number. SIAT accepts it only when the point
   * of sale has no valid CUIS or CUFD, so the point of sale must be retired first (`active=false`
   * stops renewal) and its codes must have expired.
   */
  async close(id: string, userId: string) {
    const pos = await this.findPointOfSale(id);
    if (pos.codigo_punto_venta === BRANCH_POINT_OF_SALE) {
      throw new BadRequestException({
        code: 'SIAT_POS_ZERO',
        message: 'Point of sale 0 belongs to the branch and cannot be closed',
      });
    }
    if (pos.closed_at) {
      throw new ConflictException({
        code: 'SIAT_POS_CLOSED',
        message: 'Already closed',
      });
    }
    if (pos.active) {
      throw new ConflictException({
        code: 'SIAT_POS_ACTIVE',
        message: 'Retire the point of sale (active=false) before closing it',
      });
    }
    await this.assertNoOpenShifts(id);
    const now = this.clock.now();
    const [validCuis, validCufd] = await Promise.all([
      this.prisma.siatCuis.findFirst({
        where: { point_of_sale_id: id, active: true, valid_until: { gt: now } },
        select: { valid_until: true },
      }),
      this.prisma.siatCufd.findFirst({
        where: { point_of_sale_id: id, valid_until: { gt: now } },
        select: { valid_until: true },
      }),
    ]);
    if (validCuis || validCufd) {
      throw new ConflictException({
        code: 'SIAT_POS_HAS_VALID_CODES',
        message:
          'SIAT closes a point of sale only when its CUIS and CUFD have expired',
        cuisValidUntil: validCuis?.valid_until ?? null,
        cufdValidUntil: validCufd?.valid_until ?? null,
      });
    }

    const branchCuis = await this.branchCuis(pos.branch_id, userId);
    const identity = await this.codes.identity();
    const result = await this.client.invoke(
      SIAT_OPERATIONS.FacturacionOperaciones.cierrePuntoVenta,
      cierrePuntoVentaRequest(
        identity,
        pos.branch.codigo_sucursal,
        pos.codigo_punto_venta,
        branchCuis,
      ),
      { pointOfSaleId: id },
    );
    if (!result.transaccion) {
      throw new SiatRejectedError('cierrePuntoVenta', result.mensajes);
    }

    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.siatCuis.updateMany({
        where: { point_of_sale_id: id, active: true },
        data: { active: false },
      });
      return tx.siatPointOfSale.update({
        where: { id },
        data: { active: false, closed_at: now },
      });
    });
    await this.audit.create({
      userId,
      event: 'SIAT_POS_CLOSED',
      metadata: {
        pointOfSaleId: id,
        codigoSucursal: pos.branch.codigo_sucursal,
        codigoPuntoVenta: pos.codigo_punto_venta,
      },
    });
    return closed;
  }

  /** CUIS of the branch (its point of sale 0), obtained or renewed when needed. */
  private async branchCuis(
    branchId: string,
    userId: string | null,
  ): Promise<string> {
    const pos0 = await this.prisma.siatPointOfSale.findUnique({
      where: {
        branch_id_codigo_punto_venta: {
          branch_id: branchId,
          codigo_punto_venta: BRANCH_POINT_OF_SALE,
        },
      },
      select: { id: true },
    });
    if (!pos0) {
      throw new ConflictException({
        code: 'SIAT_BRANCH_WITHOUT_POS_ZERO',
        message: 'The branch has no point of sale 0',
      });
    }
    return this.codes.cuisCode(pos0.id, { userId });
  }

  private async assertNoOpenShifts(pointOfSaleId: string) {
    const open = await this.prisma.shift.count({
      where: { point_of_sale_id: pointOfSaleId, status: ShiftStatus.OPEN },
    });
    if (open > 0) {
      throw new ConflictException({
        code: 'SIAT_POS_HAS_OPEN_SHIFTS',
        message: 'Close the open shifts on this point of sale first',
      });
    }
  }

  private async findBranch(id: string) {
    const branch = await this.prisma.siatBranch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('SIAT branch not found');
    return branch;
  }

  private async findPointOfSale(id: string) {
    const pos = await this.prisma.siatPointOfSale.findUnique({
      where: { id },
      include: { branch: { select: { codigo_sucursal: true } } },
    });
    if (!pos) throw new NotFoundException('SIAT point of sale not found');
    return pos;
  }
}
