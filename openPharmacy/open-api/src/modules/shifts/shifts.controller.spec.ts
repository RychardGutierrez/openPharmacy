import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';

describe('ShiftsController', () => {
  let controller: ShiftsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftsController],
      providers: [
        ShiftsService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditLogRepository, useValue: {} },
      ],
    }).compile();

    controller = module.get<ShiftsController>(ShiftsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
