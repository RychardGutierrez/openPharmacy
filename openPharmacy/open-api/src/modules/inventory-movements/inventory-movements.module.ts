import { Module } from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsRepository } from './repositories/inventory-movements.repository';

@Module({
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsService, InventoryMovementsRepository],
  exports: [InventoryMovementsRepository],
})
export class InventoryMovementsModule {}
