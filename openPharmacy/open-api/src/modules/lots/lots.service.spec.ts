/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Lot, Product, ProductCategory } from '@prisma/client';
import { LotsService } from './lots.service';
import { LotsRepository } from './repositories/lots.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { LotNotFoundException } from './exceptions/lot-not-found.exception';
import { DuplicateLotNumberException } from './exceptions/duplicate-lot-number.exception';
import { LotHasDependenciesException } from './exceptions/lot-has-dependencies.exception';
import { LotHasStockException } from './exceptions/lot-has-stock.exception';
import { LotAlreadyVoidedException } from './exceptions/lot-already-voided.exception';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { VoidLotDto } from './dto/void-lot.dto';

const mockLot = (overrides: Partial<Lot> = {}): Lot => ({
  id: 'lot-1',
  product_id: 'product-1',
  lot_number: 'LOT-001',
  expiry_date: new Date('2027-12-31'),
  initial_qty: 100,
  current_qty: 100,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  created_at: new Date(),
  ...overrides,
});

const mockProduct = (): Product => ({
  id: 'product-1',
  dci_name: 'Paracetamol',
  commercial_name: 'Tylenol',
  laboratory: 'PharmaCo',
  form: 'Tablet',
  concentration: '500mg',
  barcode: '7501234567890',
  category: ProductCategory.OTC,
  sale_price: 12.5 as unknown as Product['sale_price'],
  cost_price: 8.0 as unknown as Product['cost_price'],
  min_stock: 10,
  active: true,
  deleted_at: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockLotWithProduct = (
  overrides: Partial<Lot> = {},
): Lot & { product: Product } => ({
  ...mockLot(overrides),
  product: mockProduct(),
});

const mockTx: unknown = {};

describe('LotsService', () => {
  let service: LotsService;
  let lots: jest.Mocked<LotsRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let audit: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    lots = {
      createTx: jest.fn(),
      findById: jest.fn(),
      findByProductIdAndLotNumber: jest.fn(),
      findByProductId: jest.fn(),
      findByLotNumber: jest.fn(),
      findAllActiveLots: jest.fn(),
      findAllPaginated: jest.fn(),
      countDependencies: jest.fn(),
      updateTx: jest.fn(),
      voidTx: jest.fn(),
    } as unknown as jest.Mocked<LotsRepository>;

    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockTx),
      ),
    } as unknown as jest.Mocked<PrismaService>;

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    audit = {
      createInTx: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotsService,
        { provide: LotsRepository, useValue: lots },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuditLogRepository, useValue: audit },
      ],
    }).compile();

    service = module.get<LotsService>(LotsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a lot and emits lot.created', async () => {
      const dto: CreateLotDto = {
        productId: 'product-1',
        lotNumber: 'LOT-001',
        expiryDate: '2027-12-31',
        initialQty: 100,
      };
      const created = mockLot();

      lots.findByProductIdAndLotNumber.mockResolvedValue(null);
      lots.createTx.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result.lotNumber).toBe(dto.lotNumber);
      expect(result.initialQty).toBe(dto.initialQty);
      expect(lots.createTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          product_id: dto.productId,
          lot_number: dto.lotNumber,
          initial_qty: dto.initialQty,
          current_qty: dto.initialQty,
        }),
      );
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'LOT_CREATED' }),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalled();
    });

    it('throws on duplicate lot number for same product', async () => {
      const dto: CreateLotDto = {
        productId: 'product-1',
        lotNumber: 'LOT-001',
        expiryDate: '2027-12-31',
        initialQty: 100,
      };

      lots.findByProductIdAndLotNumber.mockResolvedValue(mockLot());

      await expect(service.create(dto)).rejects.toThrow(
        DuplicateLotNumberException,
      );
    });

    it('rejects expiry dates in the past', async () => {
      const dto: CreateLotDto = {
        productId: 'product-1',
        lotNumber: 'LOT-001',
        expiryDate: '2020-01-01',
        initialQty: 100,
      };

      await expect(service.create(dto)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: 'EXPIRY_DATE_IN_PAST',
          }) as { code: string },
        }) as Error,
      );
    });
  });

  describe('update', () => {
    it('corrects lot number when lot has no history', async () => {
      const dto: UpdateLotDto = {
        lotNumber: 'LOT-002',
        reason: 'Typo correction',
      };
      const existing = mockLotWithProduct();
      const updated = mockLot({ lot_number: 'LOT-002' });

      lots.findById.mockResolvedValue(existing);
      lots.countDependencies.mockResolvedValue({
        inventoryMovements: 0,
        saleItems: 0,
        returnItems: 0,
      });
      lots.findByProductIdAndLotNumber.mockResolvedValue(null);
      lots.updateTx.mockResolvedValue(updated);

      const result = await service.update('lot-1', dto);

      expect(result.lotNumber).toBe('LOT-002');
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'LOT_UPDATED' }),
      );
    });

    it('blocks update when lot has dependencies', async () => {
      const dto: UpdateLotDto = {
        lotNumber: 'LOT-002',
        reason: 'Typo correction',
      };
      const existing = mockLotWithProduct();

      lots.findById.mockResolvedValue(existing);
      lots.countDependencies.mockResolvedValue({
        inventoryMovements: 1,
        saleItems: 0,
        returnItems: 0,
      });

      await expect(service.update('lot-1', dto)).rejects.toThrow(
        LotHasDependenciesException,
      );
    });
  });

  describe('void', () => {
    it('voids a zero-stock lot with no history', async () => {
      const dto: VoidLotDto = { reason: 'Created by mistake' };
      const existing = mockLotWithProduct({ current_qty: 0 });
      const voided = mockLot({
        current_qty: 0,
        voided_at: new Date(),
        void_reason: dto.reason,
      });

      lots.findById.mockResolvedValue(existing);
      lots.countDependencies.mockResolvedValue({
        inventoryMovements: 0,
        saleItems: 0,
        returnItems: 0,
      });
      lots.voidTx.mockResolvedValue(voided);

      const result = await service.void('lot-1', dto);

      expect(result.voidReason).toBe(dto.reason);
      expect(audit.createInTx).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ event: 'LOT_VOIDED' }),
      );
    });

    it('blocks void when lot still has stock', async () => {
      const dto: VoidLotDto = { reason: 'Created by mistake' };
      const existing = mockLotWithProduct({ current_qty: 10 });

      lots.findById.mockResolvedValue(existing);

      await expect(service.void('lot-1', dto)).rejects.toThrow(
        LotHasStockException,
      );
    });

    it('throws when lot is already voided', async () => {
      const dto: VoidLotDto = { reason: 'Created by mistake' };
      const existing = mockLotWithProduct({ voided_at: new Date() });

      lots.findById.mockResolvedValue(existing);

      await expect(service.void('lot-1', dto)).rejects.toThrow(
        LotAlreadyVoidedException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the mapped lot when found', async () => {
      const existing = mockLotWithProduct({ id: 'lot-find-1' });

      lots.findById.mockResolvedValue(existing);

      const result = await service.findOne('lot-find-1');

      expect(result.id).toBe('lot-find-1');
      expect(result.lotNumber).toBe('LOT-001');
      expect(lots.findById).toHaveBeenCalledWith('lot-find-1');
    });

    it('throws LotNotFoundException when lot does not exist', async () => {
      lots.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        LotNotFoundException,
      );
    });
  });

  describe('traceByLotNumber', () => {
    it('throws when lot is not found', async () => {
      lots.findByLotNumber.mockResolvedValue(null);

      await expect(service.traceByLotNumber('UNKNOWN')).rejects.toThrow(
        LotNotFoundException,
      );
    });
  });

  describe('getExpiryDashboard', () => {
    it('classifies lots by expiry windows', async () => {
      lots.findAllActiveLots.mockResolvedValue([
        mockLotWithProduct({
          expiry_date: new Date('2026-08-15'),
          lot_number: 'NEAR-001',
        }),
        mockLotWithProduct({
          expiry_date: new Date('2027-12-31'),
          lot_number: 'FAR-001',
        }),
      ]);

      const result = await service.getExpiryDashboard();

      expect(result.red.count + result.orange.count).toBeGreaterThanOrEqual(1);
      expect(result.green.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated mapped lots', async () => {
      lots.findAllPaginated.mockResolvedValue({
        data: [mockLotWithProduct()],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(lots.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      });
    });
  });
});
