import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma, AdjustmentStatus, AdjustmentDirection } from '@prisma/client';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryMovementsRepository } from './repositories/inventory-movements.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';

const mockTx = {
  inventoryAdjustment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  inventoryMovement: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  lot: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
  auditLog: {
    create: jest.fn(),
  },
} as unknown as Prisma.TransactionClient;

describe('InventoryMovementsService', () => {
  let service: InventoryMovementsService;
  let movementsRepo: jest.Mocked<Partial<InventoryMovementsRepository>>;
  let auditRepo: jest.Mocked<Partial<AuditLogRepository>>;

  beforeEach(async () => {
    movementsRepo = {
      createAdjustmentTx: jest.fn(),
      lockPendingAdjustmentTx: jest.fn(),
      lockLotTx: jest.fn(),
      createTx: jest.fn(),
      incrementStockTx: jest.fn(),
      approveAdjustmentTx: jest.fn(),
      rejectAdjustmentTx: jest.fn(),
    };

    auditRepo = {
      createInTx: jest.fn(),
    };

    const prismaService = {
      $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
        fn(mockTx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryMovementsService,
        {
          provide: InventoryMovementsRepository,
          useValue: movementsRepo,
        },
        { provide: AuditLogRepository, useValue: auditRepo },
        { provide: 'PrismaService', useValue: prismaService },
        {
          provide: InventoryMovementsService,
          useFactory: () =>
            new InventoryMovementsService(
              prismaService as unknown as PrismaService,
              movementsRepo as InventoryMovementsRepository,
              auditRepo as AuditLogRepository,
            ),
        },
      ],
    }).compile();

    service = module.get<InventoryMovementsService>(InventoryMovementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAdjustment', () => {
    it('creates a pending adjustment without changing stock', async () => {
      const dto = {
        productId: 'product-id',
        lotId: 'lot-id',
        quantity: 5,
        direction: AdjustmentDirection.INCREASE,
        reason: 'Found extra units',
      };
      const created = {
        id: 'adj-id',
        product_id: dto.productId,
        lot_id: dto.lotId,
        requested_by: 'requester-id',
        quantity: dto.quantity,
        direction: dto.direction,
        movementType: 'MANUAL_ADJUSTMENT' as const,
        reason: dto.reason,
        status: AdjustmentStatus.PENDING,
        approved_by: null,
        approved_at: null,
        created_at: new Date(),
      };

      (movementsRepo.createAdjustmentTx as jest.Mock).mockResolvedValue(
        created,
      );
      (auditRepo.createInTx as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createAdjustment('requester-id', dto);

      expect(result).toMatchObject({
        id: 'adj-id',
        status: 'PENDING',
      });
      expect(movementsRepo.createAdjustmentTx).toHaveBeenCalledWith(mockTx, {
        product_id: dto.productId,
        lot_id: dto.lotId,
        requested_by: 'requester-id',
        quantity: dto.quantity,
        direction: dto.direction,
        movementType: 'MANUAL_ADJUSTMENT',
        reason: dto.reason,
      });
      expect(movementsRepo.incrementStockTx).not.toHaveBeenCalled();
    });
  });

  describe('approveAdjustment', () => {
    it('approves an increase adjustment and writes a movement', async () => {
      const adjustment = {
        id: 'adj-id',
        product_id: 'product-id',
        lot_id: 'lot-id',
        requested_by: 'requester-id',
        quantity: 5,
        direction: AdjustmentDirection.INCREASE,
        movementType: 'MANUAL_ADJUSTMENT' as const,
        reason: 'Found extra units',
        status: AdjustmentStatus.PENDING,
        approved_by: null,
        approved_at: null,
        created_at: new Date(),
      };
      const lot = {
        id: 'lot-id',
        current_qty: 10,
      };
      const movement = {
        id: 'mov-id',
        product_id: 'product-id',
        lot_id: 'lot-id',
        user_id: 'requester-id',
        movementType: 'MANUAL_ADJUSTMENT' as const,
        quantity: 5,
        reason: 'Found extra units',
        approved_by: 'admin-id',
        created_at: new Date(),
      };
      const approved = { ...adjustment, status: AdjustmentStatus.APPROVED };

      (movementsRepo.lockPendingAdjustmentTx as jest.Mock).mockResolvedValue(
        adjustment,
      );
      (movementsRepo.lockLotTx as jest.Mock).mockResolvedValue(lot as any);
      (movementsRepo.createTx as jest.Mock).mockResolvedValue(movement);
      (movementsRepo.incrementStockTx as jest.Mock).mockResolvedValue({
        ...lot,
        current_qty: 15,
      } as any);
      (movementsRepo.approveAdjustmentTx as jest.Mock).mockResolvedValue(
        approved,
      );
      (auditRepo.createInTx as jest.Mock).mockResolvedValue(undefined);

      const result = await service.approveAdjustment('admin-id', 'adj-id');

      expect(result.adjustment.status).toBe('APPROVED');
      expect(result.movement.id).toBe('mov-id');
      expect(movementsRepo.incrementStockTx).toHaveBeenCalledWith(
        mockTx,
        'lot-id',
        5,
      );
    });

    it('rejects a decrease that would drive stock negative', async () => {
      const adjustment = {
        id: 'adj-id',
        product_id: 'product-id',
        lot_id: 'lot-id',
        requested_by: 'requester-id',
        quantity: 20,
        direction: AdjustmentDirection.DECREASE,
        movementType: 'MANUAL_ADJUSTMENT' as const,
        reason: 'Damaged',
        status: AdjustmentStatus.PENDING,
        approved_by: null,
        approved_at: null,
        created_at: new Date(),
      };
      const lot = {
        id: 'lot-id',
        current_qty: 10,
      };

      (movementsRepo.lockPendingAdjustmentTx as jest.Mock).mockResolvedValue(
        adjustment,
      );
      (movementsRepo.lockLotTx as jest.Mock).mockResolvedValue(lot as any);

      await expect(
        service.approveAdjustment('admin-id', 'adj-id'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects self-approval', async () => {
      const adjustment = {
        id: 'adj-id',
        product_id: 'product-id',
        lot_id: 'lot-id',
        requested_by: 'requester-id',
        quantity: 5,
        direction: AdjustmentDirection.INCREASE,
        movementType: 'MANUAL_ADJUSTMENT' as const,
        reason: 'Found extra units',
        status: AdjustmentStatus.PENDING,
        approved_by: null,
        approved_at: null,
        created_at: new Date(),
      };
      const lot = {
        id: 'lot-id',
        current_qty: 10,
      };

      (movementsRepo.lockPendingAdjustmentTx as jest.Mock).mockResolvedValue(
        adjustment,
      );
      (movementsRepo.lockLotTx as jest.Mock).mockResolvedValue(lot as any);

      await expect(
        service.approveAdjustment('requester-id', 'adj-id'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
