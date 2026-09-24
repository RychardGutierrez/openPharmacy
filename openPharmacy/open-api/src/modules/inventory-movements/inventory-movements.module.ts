import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsRepository } from './repositories/inventory-movements.repository';

@Module({
  imports: [AuditModule],
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsService, InventoryMovementsRepository],
  exports: [InventoryMovementsService, InventoryMovementsRepository],
})
export class InventoryMovementsModule {}
