import { Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { LotsModule } from '../lots/lots.module';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../../common/audit/audit.module';
import { SalesRepository } from './repositories/sales.repository';

@Module({
  imports: [ShiftsModule, LotsModule, ConfigModule, AuditModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
})
export class SalesModule {}
