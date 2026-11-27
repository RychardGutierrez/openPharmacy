import { forwardRef, Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { LotsModule } from '../lots/lots.module';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../../common/audit/audit.module';
import { SalesRepository } from './repositories/sales.repository';
import { ReturnsModule } from '../returns/returns.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    ShiftsModule,
    LotsModule,
    InventoryMovementsModule,
    ConfigModule,
    AuditModule,
    ProductsModule,
    forwardRef(() => ReturnsModule),
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesRepository],
})
export class SalesModule {}
