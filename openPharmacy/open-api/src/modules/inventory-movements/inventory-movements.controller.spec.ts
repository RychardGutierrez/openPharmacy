import { Test, TestingModule } from '@nestjs/testing';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';

describe('InventoryMovementsController', () => {
  let controller: InventoryMovementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryMovementsController],
      providers: [InventoryMovementsService],
    }).compile();

    controller = module.get<InventoryMovementsController>(InventoryMovementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
