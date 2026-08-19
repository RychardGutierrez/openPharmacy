import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ShiftsService } from './shifts.service';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prisma: {
    shift: Record<string, jest.Mock>;
    sale: Record<string, jest.Mock>;
    shiftReopenRequest: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let audit: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      shift: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      sale: { aggregate: jest.fn() },
      shiftReopenRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    audit = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogRepository, useValue: audit },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
  });

  it('opens a shift and records an audit event', async () => {
    const shift = { id: 'shift-1', user_id: 'user-1', status: 'OPEN' };
    prisma.shift.create.mockResolvedValue(shift);

    await expect(service.open('user-1', { openingCash: 250 })).resolves.toBe(
      shift,
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'SHIFT_OPENED', userId: 'user-1' }),
    );
  });

  it('returns the current open shift for a user', async () => {
    const shift = { id: 'shift-1', user_id: 'user-1', status: 'OPEN' };
    prisma.shift.findFirst.mockResolvedValue(shift);

    await expect(service.findCurrent('user-1')).resolves.toBe(shift);
    expect(prisma.shift.findFirst).toHaveBeenCalledWith({
      where: { user_id: 'user-1', status: 'OPEN' },
      orderBy: { opened_at: 'desc' },
    });
  });

  it('lists only the current user shifts in reverse opening order', async () => {
    const shifts = [{ id: 'shift-1', user_id: 'user-1' }];
    prisma.shift.findMany.mockResolvedValue(shifts);

    await expect(service.findMine('user-1')).resolves.toBe(shifts);
    expect(prisma.shift.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      orderBy: { opened_at: 'desc' },
    });
  });

  it('translates the partial unique-index violation to HTTP 409', async () => {
    prisma.shift.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.open('user-1', { openingCash: 250 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('recomputes expected cash and difference from persisted sales', async () => {
    prisma.shift.findUnique.mockResolvedValue({
      id: 'shift-1',
      user_id: 'user-1',
      opening_cash: 100,
      status: 'OPEN',
    });
    prisma.sale.aggregate.mockResolvedValue({
      _sum: { cash_received: 75, change_given: 5 },
    });
    prisma.shift.update.mockResolvedValue({ id: 'shift-1', status: 'CLOSED' });

    await expect(
      service.close('user-1', 'shift-1', { closingCash: 160 }),
    ).resolves.toEqual({
      shift: { id: 'shift-1', status: 'CLOSED' },
      countedCash: 160,
      expectedCash: 170,
      difference: 10,
    });
    expect(prisma.sale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shift_id: 'shift-1',
          paymentMethod: 'CASH',
          status: 'COMPLETED',
        },
      }),
    );
    const updateCall = prisma.shift.update.mock.calls[0] as unknown as [
      { data: { closing_cash: number; expected_cash: number } },
    ];
    expect(updateCall[0].data.closing_cash).toBe(160);
    expect(updateCall[0].data.expected_cash).toBe(170);
  });

  it('blocks sales when the cashier has no active shift', async () => {
    prisma.shift.findFirst.mockResolvedValue(null);

    await expect(service.validateActiveShift('user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('approves a pending reopen request and reopens the shift', async () => {
    prisma.shiftReopenRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      shift_id: 'shift-1',
      status: 'PENDING',
    });
    prisma.shift.findUnique.mockResolvedValue({
      id: 'shift-1',
      status: 'CLOSED',
    });
    prisma.shift.update.mockResolvedValue({ id: 'shift-1', status: 'OPEN' });
    prisma.shiftReopenRequest.update.mockResolvedValue({
      id: 'request-1',
      status: 'APPROVED',
    });

    await expect(
      service.approveReopen('admin-1', 'request-1'),
    ).resolves.toEqual({ id: 'shift-1', status: 'OPEN' });
    expect(prisma.shift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'OPEN',
          closing_cash: null,
          expected_cash: null,
          closed_at: null,
        },
      }),
    );
  });
});
