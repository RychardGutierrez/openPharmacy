import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';
import { AuditModule } from '../../common/audit/audit.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';

@Module({
  imports: [AuditModule, SuppliersModule, InventoryMovementsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PurchaseOrdersRepository],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
