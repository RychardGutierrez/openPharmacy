import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardSaleListener } from './dashboard-sale.listener';
import { DASHBOARD_EVENTS } from './dashboard-events.token';
import { Subject } from 'rxjs';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardSaleListener,
    {
      provide: DASHBOARD_EVENTS,
      useFactory: () => new Subject<MessageEvent>(),
    },
  ],
  exports: [DASHBOARD_EVENTS],
})
export class DashboardModule {}
