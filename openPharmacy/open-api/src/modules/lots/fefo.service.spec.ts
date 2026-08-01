/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { FefoService } from './fefo.service';
import { LotsRepository } from './repositories/lots.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { InsufficientStockException } from './exceptions/insufficient-stock.exception';

const mockTx = {} as never;

describe('FefoService', () => {
  let service: FefoService;
  let lots: jest.Mocked<LotsRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    lots = {
      callFefo: jest.fn(),
    } as unknown as jest.Mocked<LotsRepository>;

    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockTx),
      ),
    } as unknown as jest.Mocked<PrismaService>;

    audit = {
      createInTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FefoService,
        { provide: LotsRepository, useValue: lots },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogRepository, useValue: audit },
      ],
    }).compile();

    service = module.get<FefoService>(FefoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns deduction breakdown on success', async () => {
    lots.callFefo.mockResolvedValue([
      { lot_id: 'lot-1', lot_number: 'LOT-001', deducted_qty: 10 },
    ]);

    const result = await service.deductStock('product-1', 10, 'user-1');

    expect(result.success).toBe(true);
    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lotId).toBe('lot-1');
    expect(result.lotsUsed[0].deductedQty).toBe(10);
    expect(audit.createInTx).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ event: 'STOCK_DEDUCTED_FEFO' }),
    );
  });

  it('throws InsufficientStockException when the PG function reports insufficient stock', async () => {
    lots.callFefo.mockRejectedValue(
      new Error(
        'fn_deduct_stock_fefo: insufficient active non-expired stock for product product-1',
      ),
    );

    await expect(service.deductStock('product-1', 1000)).rejects.toThrow(
      InsufficientStockException,
    );
  });
});
