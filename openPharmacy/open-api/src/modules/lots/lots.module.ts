import { Module } from '@nestjs/common';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';
import { FefoService } from './fefo.service';
import { LotsRepository } from './repositories/lots.repository';
import { AuditModule } from '../../common/audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';

@Module({
  imports: [AuditModule, InventoryMovementsModule],
  controllers: [LotsController],
  providers: [LotsService, FefoService, LotsRepository],
  exports: [LotsService, FefoService],
})
export class LotsModule {}
