import { Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [ShiftsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
