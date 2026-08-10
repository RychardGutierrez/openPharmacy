import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
