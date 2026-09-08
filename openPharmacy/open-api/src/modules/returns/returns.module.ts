import { forwardRef, Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { ReturnsRepository } from './repositories/returns.repository';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { AuditModule } from '../../common/audit/audit.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    InventoryMovementsModule,
    AuditModule,
    forwardRef(() => SalesModule),
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsRepository],
  exports: [ReturnsService, ReturnsRepository],
})
export class ReturnsModule {}
