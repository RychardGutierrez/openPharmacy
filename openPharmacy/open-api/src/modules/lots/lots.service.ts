import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { Prisma, Lot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { LotsRepository } from './repositories/lots.repository';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { VoidLotDto } from './dto/void-lot.dto';
import { LotResponseDto } from './dto/lot-response.dto';
import {
  ExpiryDashboardLotDto,
  ExpiryDashboardResponseDto,
} from './dto/expiry-dashboard-response.dto';
import { LotTraceResponseDto } from './dto/lot-trace-response.dto';
import { LotNotFoundException } from './exceptions/lot-not-found.exception';
import { DuplicateLotNumberException } from './exceptions/duplicate-lot-number.exception';
import { LotAlreadyVoidedException } from './exceptions/lot-already-voided.exception';
import { LotHasDependenciesException } from './exceptions/lot-has-dependencies.exception';
import { LotNotEditableException } from './exceptions/lot-not-editable.exception';
import { LotHasStockException } from './exceptions/lot-has-stock.exception';
import { ExpiryStatus } from './events/lot-expiry-alert.event';
import { RequestMetadata } from '../users/users.service';

@Injectable()
export class LotsService {
  private readonly logger = new Logger(LotsService.name);

  constructor(
    private readonly lots: LotsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    dto: CreateLotDto,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<LotResponseDto> {
    const expiryDate = new Date(dto.expiryDate);
    this.assertFutureOrTodayExpiry(expiryDate);

    const existing = await this.lots.findByProductIdAndLotNumber(
      dto.productId,
      dto.lotNumber,
    );
    if (existing) {
      throw new DuplicateLotNumberException(dto.productId, dto.lotNumber);
    }

    const lot = await this.prisma.$transaction(async (tx) => {
      const created = await this.lots.createTx(tx, {
        product_id: dto.productId,
        lot_number: dto.lotNumber,
        expiry_date: expiryDate,
        initial_qty: dto.initialQty,
        current_qty: dto.initialQty,
        voided_at: null,
        voided_by: null,
        void_reason: null,
      });

      await this.audit.createInTx(tx, {
        userId: userId ?? null,
        event: 'LOT_CREATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          lotId: created.id,
          productId: created.product_id,
          lotNumber: created.lot_number,
          expiryDate: created.expiry_date,
          initialQty: created.initial_qty,
        },
      });

      return created;
    });

    this.emitLotCreated(lot);
    return this.toResponse(lot);
  }

  async findByProduct(
    productId: string,
    includeVoided = false,
  ): Promise<LotResponseDto[]> {
    const lots = await this.lots.findByProductId(productId, includeVoided);
    return lots.map((lot) => this.toResponse(lot));
  }

  async findOne(id: string): Promise<LotResponseDto> {
    const lot = await this.lots.findById(id);
    if (!lot) {
      throw new LotNotFoundException(id);
    }
    return this.toResponse(lot);
  }

  async findAll(query: {
    page: number;
    pageSize: number;
    productId?: string;
    includeVoided?: boolean;
    q?: string;
  }): Promise<{
    data: LotResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const result = await this.lots.findAllPaginated(query);
    return {
      data: result.data.map((lot) => this.toResponse(lot)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async getExpiryDashboard(): Promise<ExpiryDashboardResponseDto> {
    const lots = await this.lots.findAllActiveLots();
    const generatedAt = new Date();

    const classified = lots.map((lot) => {
      const status = this.classifyExpiry(lot.expiry_date);
      return {
        lot,
        status,
        daysUntilExpiry: this.daysUntilExpiry(lot.expiry_date),
      };
    });

    const byStatus = (status: ExpiryStatus) =>
      classified
        .filter((c) => c.status === status)
        .map((c) =>
          plainToInstance(
            ExpiryDashboardLotDto,
            {
              id: c.lot.id,
              productId: c.lot.product_id,
              productName: c.lot.product.commercial_name,
              lotNumber: c.lot.lot_number,
              expiryDate: c.lot.expiry_date,
              currentQty: c.lot.current_qty,
              status: c.status,
              daysUntilExpiry: c.daysUntilExpiry,
            },
            { excludeExtraneousValues: true },
          ),
        );

    return plainToInstance(
      ExpiryDashboardResponseDto,
      {
        generatedAt,
        red: {
          status: 'RED',
          count: byStatus('RED').length,
          lots: byStatus('RED'),
        },
        orange: {
          status: 'ORANGE',
          count: byStatus('ORANGE').length,
          lots: byStatus('ORANGE'),
        },
        green: {
          status: 'GREEN',
          count: byStatus('GREEN').length,
          lots: byStatus('GREEN'),
        },
      },
      { excludeExtraneousValues: true },
    );
  }

  async traceByLotNumber(lotNumber: string): Promise<LotTraceResponseDto> {
    const lot = await this.lots.findByLotNumber(lotNumber);
    if (!lot) {
      throw new LotNotFoundException(lotNumber);
    }

    const [movements, saleItems] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { lot_id: lot.id },
        include: { user: true },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.saleItem.findMany({
        where: { lot_id: lot.id },
        include: { sale: true },
        orderBy: { sale: { created_at: 'desc' } },
      }),
    ]);

    return plainToInstance(
      LotTraceResponseDto,
      {
        id: lot.id,
        lotNumber: lot.lot_number,
        expiryDate: lot.expiry_date,
        initialQty: lot.initial_qty,
        currentQty: lot.current_qty,
        product: {
          id: lot.product.id,
          dciName: lot.product.dci_name,
          commercialName: lot.product.commercial_name,
          barcode: lot.product.barcode,
          category: lot.product.category,
        },
        movements: movements.map((m) => ({
          id: m.id,
          movementType: m.movementType,
          quantity: m.quantity,
          reason: m.reason,
          createdAt: m.created_at,
          userFullName: m.user.full_name,
        })),
        saleItems: saleItems.map((si) => ({
          id: si.id,
          saleId: si.sale_id,
          quantity: si.quantity,
          unitPrice: Number(si.unit_price),
          lineTotal: Number(si.line_total),
          createdAt: si.sale.created_at,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  async update(
    id: string,
    dto: UpdateLotDto,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<LotResponseDto> {
    const lot = await this.lots.findById(id);
    if (!lot) {
      throw new LotNotFoundException(id);
    }

    await this.assertEditableForIdentityChange(lot);

    const updateData: Prisma.LotUncheckedUpdateInput = {};

    if (dto.lotNumber && dto.lotNumber !== lot.lot_number) {
      const existing = await this.lots.findByProductIdAndLotNumber(
        lot.product_id,
        dto.lotNumber,
      );
      if (existing && existing.id !== id) {
        throw new DuplicateLotNumberException(lot.product_id, dto.lotNumber);
      }
      updateData.lot_number = dto.lotNumber;
    }

    if (dto.expiryDate) {
      const expiryDate = new Date(dto.expiryDate);
      if (expiryDate.getTime() !== lot.expiry_date.getTime()) {
        this.assertFutureOrTodayExpiry(expiryDate);
        updateData.expiry_date = expiryDate;
      }
    }

    const changedFields = Object.keys(updateData);
    if (changedFields.length === 0) {
      return this.toResponse(lot);
    }

    const before = { lotNumber: lot.lot_number, expiryDate: lot.expiry_date };

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.lots.updateTx(tx, id, updateData);

      await this.audit.createInTx(tx, {
        userId: userId ?? null,
        event: 'LOT_UPDATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          lotId: result.id,
          productId: result.product_id,
          before,
          after: {
            lotNumber: result.lot_number,
            expiryDate: result.expiry_date,
          },
          reason: dto.reason,
          changedFields,
        },
      });

      return result;
    });

    this.emitLotUpdated(updated, changedFields);
    return this.toResponse(updated);
  }

  async void(
    id: string,
    dto: VoidLotDto,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<LotResponseDto> {
    const lot = await this.lots.findById(id);
    if (!lot) {
      throw new LotNotFoundException(id);
    }

    if (lot.voided_at) {
      throw new LotAlreadyVoidedException(id);
    }

    if (lot.current_qty !== 0) {
      throw new LotHasStockException(id);
    }

    const deps = await this.lots.countDependencies(id);
    if (
      deps.inventoryMovements > 0 ||
      deps.saleItems > 0 ||
      deps.returnItems > 0
    ) {
      throw new LotHasDependenciesException(id);
    }

    const voidedBy = userId ?? 'system';
    const voided = await this.prisma.$transaction(async (tx) => {
      const result = await this.lots.voidTx(tx, id, voidedBy, dto.reason);

      await this.audit.createInTx(tx, {
        userId: userId ?? null,
        event: 'LOT_VOIDED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          lotId: result.id,
          productId: result.product_id,
          reason: dto.reason,
        },
      });

      return result;
    });

    this.emitLotVoided(voided, dto.reason);
    return this.toResponse(voided);
  }

  classifyExpiry(expiryDate: Date): ExpiryStatus {
    const days = this.daysUntilExpiry(expiryDate);
    if (days <= 30) return 'RED';
    if (days <= 60) return 'ORANGE';
    return 'GREEN';
  }

  daysUntilExpiry(expiryDate: Date): number {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);
    const diff = expiry.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private assertFutureOrTodayExpiry(expiryDate: Date): void {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);

    if (expiry < today) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'EXPIRY_DATE_IN_PAST',
        field: 'expiryDate',
        message: 'Expiry date cannot be in the past for active stock',
      });
    }
  }

  private async assertEditableForIdentityChange(lot: Lot): Promise<void> {
    if (lot.voided_at) {
      throw new LotAlreadyVoidedException(lot.id);
    }

    if (lot.current_qty !== lot.initial_qty) {
      throw new LotNotEditableException(
        lot.id,
        'stock has already moved (current_qty != initial_qty)',
      );
    }

    const deps = await this.lots.countDependencies(lot.id);
    if (
      deps.inventoryMovements > 0 ||
      deps.saleItems > 0 ||
      deps.returnItems > 0
    ) {
      throw new LotHasDependenciesException(lot.id);
    }
  }

  private toResponse(lot: Lot): LotResponseDto {
    const lotWithProduct = lot as Lot & {
      product?: {
        id: string;
        dci_name: string;
        commercial_name: string;
      } | null;
    };
    return plainToInstance(LotResponseDto, {
      id: lot.id,
      productId: lot.product_id,
      lotNumber: lot.lot_number,
      expiryDate: lot.expiry_date,
      initialQty: lot.initial_qty,
      currentQty: lot.current_qty,
      voidedAt: lot.voided_at,
      voidReason: lot.void_reason,
      createdAt: lot.created_at,
      product: lotWithProduct.product
        ? {
            id: lotWithProduct.product.id,
            dciName: lotWithProduct.product.dci_name,
            commercialName: lotWithProduct.product.commercial_name,
          }
        : null,
    });
  }

  private emitLotCreated(lot: Lot): void {
    this.eventEmitter
      .emitAsync('lot.created', {
        lotId: lot.id,
        productId: lot.product_id,
        lotNumber: lot.lot_number,
        expiryDate: lot.expiry_date,
        initialQty: lot.initial_qty,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to emit lot.created event for ${lot.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  private emitLotUpdated(lot: Lot, changedFields: string[]): void {
    this.eventEmitter
      .emitAsync('lot.updated', {
        lotId: lot.id,
        productId: lot.product_id,
        changedFields,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to emit lot.updated event for ${lot.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  private emitLotVoided(lot: Lot, reason: string): void {
    this.eventEmitter
      .emitAsync('lot.voided', {
        lotId: lot.id,
        productId: lot.product_id,
        reason,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to emit lot.voided event for ${lot.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }
}
