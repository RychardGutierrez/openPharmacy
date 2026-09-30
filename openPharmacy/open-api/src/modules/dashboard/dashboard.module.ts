import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './repositories/dashboard.repository';
import { DashboardEventBus } from './dashboard-event-bus.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository, DashboardEventBus],
})
export class DashboardModule {}
