import { Test, TestingModule } from '@nestjs/testing';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryMovementsRepository } from './repositories/inventory-movements.repository';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryMovementsController', () => {
  let controller: InventoryMovementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryMovementsController],
      providers: [
        InventoryMovementsService,
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn() },
        },
        {
          provide: InventoryMovementsRepository,
          useValue: {},
        },
        {
          provide: AuditLogRepository,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<InventoryMovementsController>(
      InventoryMovementsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
