import {
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { ShiftReopenRequestStatus, ShiftStatus } from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { ReopenRequestDto } from './dto/reopen-request.dto';

export interface ShiftCloseResult {
  shift: unknown;
  countedCash: number;
  expectedCash: number;
  difference: number;
}

const money = (value: unknown): number =>
  Math.round(Number(value ?? 0) * 100) / 100;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

@Injectable()
export class ShiftsService implements OnModuleInit, OnModuleDestroy {
  private autoCloseTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogRepository,
  ) {}

  onModuleInit() {
    // Check once per minute so shifts cannot remain open past Bolivia midnight.
    this.autoCloseTimer = setInterval(() => {
      void this.closeShiftsAtBoliviaEndOfDay();
    }, 60_000);
    this.autoCloseTimer.unref();
    void this.closeShiftsAtBoliviaEndOfDay();
  }

  onModuleDestroy() {
    if (this.autoCloseTimer) clearInterval(this.autoCloseTimer);
  }

  async closeShiftsAtBoliviaEndOfDay(now = new Date()): Promise<number> {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (hour !== 0 || minute !== 0) return 0;

    const openShifts = await this.prisma.shift.findMany({
      where: { status: ShiftStatus.OPEN },
      select: { id: true, user_id: true },
    });
    let closedCount = 0;
    for (const openShift of openShifts) {
      const closed = await this.prisma.$transaction(async (tx) => {
        const shift = await tx.shift.findUnique({ where: { id: openShift.id } });
        if (!shift || shift.status !== ShiftStatus.OPEN) return false;
        const totals = await tx.sale.aggregate({
          _sum: { cash_received: true, change_given: true },
          where: { shift_id: shift.id, paymentMethod: 'CASH', status: 'COMPLETED' },
        });
        const expectedCash = money(
          Number(shift.opening_cash) +
            Number(totals._sum.cash_received ?? 0) -
            Number(totals._sum.change_given ?? 0),
        );
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            // Automatic end-of-day close uses expected cash as the count.
            closing_cash: expectedCash,
            expected_cash: expectedCash,
            status: ShiftStatus.CLOSED,
            closed_at: now,
          },
        });
        return { shift, expectedCash };
      });
      if (closed) {
        closedCount += 1;
        await this.audit.create({
          userId: openShift.user_id,
          event: 'SHIFT_CLOSED',
          metadata: {
            shiftId: openShift.id,
            countedCash: closed.expectedCash,
            expectedCash: closed.expectedCash,
            difference: 0,
            automatic: true,
            reason: 'AUTOMATIC_END_OF_DAY_CLOSE',
          },
        });
      }
    }
    return closedCount;
  }

  async open(userId: string, dto: CreateShiftDto) {
    try {
      const shift = await this.prisma.shift.create({
        data: {
          user_id: userId,
          opening_cash: dto.openingCash,
          status: ShiftStatus.OPEN,
        },
      });

      await this.audit.create({
        userId,
        event: 'SHIFT_OPENED',
        metadata: { shiftId: shift.id, openingCash: dto.openingCash },
      });
      return shift;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('User already has an open shift');
      }
      throw error;
    }
  }

  async findCurrent(userId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { user_id: userId, status: ShiftStatus.OPEN },
      orderBy: { opened_at: 'desc' },
    });
    return shift ?? null;
  }

  findMine(userId: string) {
    return this.prisma.shift.findMany({
      where: { user_id: userId },
      orderBy: { opened_at: 'desc' },
    });
  }

  async findShiftSales(userId: string, shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      select: { user_id: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.user_id !== userId) {
      throw new ForbiddenException('You can only review your own shift sales');
    }

    const sales = await this.prisma.sale.findMany({
      where: { shift_id: shiftId, status: 'COMPLETED' },
      select: {
        subtotal: true,
        total: true,
        discount: true,
        paymentMethod: true,
        saleItems: {
          select: {
            quantity: true,
            line_total: true,
            product: { select: { id: true, commercial_name: true, dci_name: true } },
          },
        },
      },
    });

    const products = new Map<string, { productId: string; name: string; quantity: number; total: number }>();
    let grossSales = 0;
    let discounts = 0;
    let returns = 0;
    const payments = { CASH: 0, CARD: 0, QR: 0, TRANSFER: 0 };
    for (const sale of sales) {
      grossSales += money(sale.subtotal);
      discounts += money(sale.discount);
      payments[sale.paymentMethod] += money(sale.total);
      for (const item of sale.saleItems) {
        const current = products.get(item.product.id) ?? {
          productId: item.product.id,
          name: item.product.commercial_name || item.product.dci_name,
          quantity: 0,
          total: 0,
        };
        current.quantity += item.quantity;
        current.total += money(item.line_total);
        products.set(item.product.id, current);
      }
    }
    const saleReturns = await this.prisma.return.findMany({
      where: { sale: { shift_id: shiftId } },
      select: {
        returnItems: {
          select: { quantity: true, saleItem: { select: { unit_price: true } } },
        },
      },
    });
    for (const saleReturn of saleReturns) {
      for (const item of saleReturn.returnItems) {
        returns += money(Number(item.saleItem.unit_price) * item.quantity);
      }
    }
    const productList = [...products.values()].map((product) => ({
      ...product,
      total: money(product.total),
    }));
    return {
      products: productList,
      totals: {
        units: productList.reduce((sum, product) => sum + product.quantity, 0),
        distinctProducts: productList.length,
        transactions: sales.length,
        grossSales: money(grossSales),
        discounts: money(discounts),
        returns: money(returns),
        netSales: money(grossSales - discounts - returns),
      },
      payments: Object.fromEntries(
        Object.entries(payments).map(([method, total]) => [method, money(total)]),
      ),
    };
  }

  async close(
    userId: string,
    shiftId: string,
    dto: CloseShiftDto,
  ): Promise<ShiftCloseResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });
      if (!shift) throw new NotFoundException('Shift not found');
      if (shift.user_id !== userId) {
        throw new ForbiddenException('You can only close your own shift');
      }
      if (shift.status !== ShiftStatus.OPEN) {
        throw new ConflictException('Shift is already closed');
      }

      const totals = await tx.sale.aggregate({
        _sum: { cash_received: true, change_given: true },
        where: {
          shift_id: shiftId,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
        },
      });
      const expectedCash = money(
        Number(shift.opening_cash) +
          Number(totals._sum.cash_received ?? 0) -
          Number(totals._sum.change_given ?? 0),
      );
      const countedCash = money(dto.closingCash);
      const difference = money(expectedCash - countedCash);
      const updated = await tx.shift.update({
        where: { id: shiftId },
        data: {
          closing_cash: countedCash,
          expected_cash: expectedCash,
          status: ShiftStatus.CLOSED,
          closed_at: new Date(),
        },
      });

      return { shift: updated, countedCash, expectedCash, difference };
    });

    await this.audit.create({
      userId,
      event: 'SHIFT_CLOSED',
      metadata: {
        shiftId,
        countedCash: result.countedCash,
        expectedCash: result.expectedCash,
        difference: result.difference,
      },
    });
    return result;
  }

  async validateActiveShift(userId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { user_id: userId, status: ShiftStatus.OPEN },
    });
    if (!shift) {
      throw new ConflictException(
        'An open shift is required to register sales',
      );
    }
    return shift;
  }

  async requestReopen(userId: string, shiftId: string, dto: ReopenRequestDto) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.user_id !== userId) {
      throw new ForbiddenException(
        'You can only request reopening your own shift',
      );
    }
    if (shift.status !== ShiftStatus.CLOSED) {
      throw new ConflictException('Only closed shifts can be reopened');
    }
    const activeShift = await this.prisma.shift.findFirst({
      where: { user_id: userId, status: ShiftStatus.OPEN },
      select: { id: true },
    });
    if (activeShift) {
      throw new ConflictException(
        'Close the active shift before requesting a reopen',
      );
    }

    try {
      const request = await this.prisma.shiftReopenRequest.create({
        data: { shift_id: shiftId, requested_by: userId, reason: dto.reason },
      });
      await this.audit.create({
        userId,
        event: 'SHIFT_REOPEN_REQUESTED',
        metadata: { shiftId, requestId: request.id, reason: dto.reason },
      });
      return request;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A reopen request already exists for this shift',
        );
      }
      throw error;
    }
  }

  findReopenRequests() {
    return this.prisma.shiftReopenRequest.findMany({
      where: { status: ShiftReopenRequestStatus.PENDING },
      orderBy: { created_at: 'asc' },
      include: { shift: true, requester: true },
    });
  }

  async reopen(requesterId: string, shiftId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const shift = await this.reopenInTransaction(tx, shiftId);
      await tx.shiftReopenRequest.updateMany({
        where: {
          shift_id: shiftId,
          status: ShiftReopenRequestStatus.PENDING,
        },
        data: {
          status: ShiftReopenRequestStatus.REJECTED,
          reviewed_by: requesterId,
          reviewed_at: new Date(),
        },
      });
      return shift;
    });
    await this.audit.create({
      userId: requesterId,
      event: 'SHIFT_REOPENED',
      metadata: { shiftId, requestId: null },
    });
    return result;
  }

  async approveReopen(adminId: string, requestId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.shiftReopenRequest.findUnique({
        where: { id: requestId },
      });
      if (!request) throw new NotFoundException('Reopen request not found');
      if (request.status !== ShiftReopenRequestStatus.PENDING) {
        throw new ConflictException('Reopen request has already been reviewed');
      }
      const shift = await this.reopenInTransaction(tx, request.shift_id);
      await tx.shiftReopenRequest.update({
        where: { id: requestId },
        data: {
          status: ShiftReopenRequestStatus.APPROVED,
          reviewed_by: adminId,
          reviewed_at: new Date(),
        },
      });
      return { shift, requestId };
    });
    await this.audit.create({
      userId: adminId,
      event: 'SHIFT_REOPENED',
      metadata: { shiftId: result.shift.id, requestId },
    });
    return result.shift;
  }

  async rejectReopen(adminId: string, requestId: string) {
    const request = await this.prisma.shiftReopenRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Reopen request not found');
    if (request.status !== ShiftReopenRequestStatus.PENDING) {
      throw new ConflictException('Reopen request has already been reviewed');
    }
    const rejected = await this.prisma.shiftReopenRequest.update({
      where: { id: requestId },
      data: {
        status: ShiftReopenRequestStatus.REJECTED,
        reviewed_by: adminId,
        reviewed_at: new Date(),
      },
    });
    await this.audit.create({
      userId: adminId,
      event: 'SHIFT_REOPEN_REQUEST_REJECTED',
      metadata: { shiftId: request.shift_id, requestId },
    });
    return rejected;
  }

  private async reopenInTransaction(
    tx: Pick<PrismaService, 'shift' | 'shiftReopenRequest'>,
    shiftId: string,
  ) {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.CLOSED) {
      throw new ConflictException('Only closed shifts can be reopened');
    }
    const activeShift = await tx.shift.findFirst({
      where: { user_id: shift.user_id, status: ShiftStatus.OPEN },
      select: { id: true },
    });
    if (activeShift) {
      throw new ConflictException(
        'Close the active shift before reopening this shift',
      );
    }
    return tx.shift.update({
      where: { id: shiftId },
      data: {
        status: ShiftStatus.OPEN,
        closing_cash: null,
        expected_cash: null,
        closed_at: null,
      },
    });
  }
}
