import { Injectable } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { DashboardEventBus } from './dashboard-event-bus.service';
import { DashboardRepository } from './repositories/dashboard.repository';
import { UserRole } from '@prisma/client';
import {
  DashboardQueryDto,
  ExpiringQueryDto,
  LowStockQueryDto,
  RecentSalesQueryDto,
  SalesTrendQueryDto,
  UnitsSoldQueryDto,
} from './dto/dashboard-query.dto';
import {
  DashboardExpiringResponseDto,
  DashboardLowStockResponseDto,
  DashboardRecentSalesResponseDto,
  KpiSummaryDto,
  DashboardSalesTrendResponseDto,
  DashboardUnitsSoldResponseDto,
} from './dto/dashboard-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

export interface DashboardSseEvent {
  type: 'sale.created' | 'alert.triggered';
  data: Record<string, unknown>;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly eventBus: DashboardEventBus,
  ) {}

  async getKpis(
    query: DashboardQueryDto,
    user: AuthenticatedUser,
  ): Promise<KpiSummaryDto> {
    const [lowStock, expiring, activeAlerts] = await Promise.all([
      this.dashboard.getLowStock(query),
      this.dashboard.getExpiring({ ...query, horizonDays: 30 }),
      this.dashboard.getExpiring({ ...query, horizonDays: 90 }),
    ]);

    return this.dashboard.getKpis(
      query,
      activeAlerts.lots.length,
      expiring.lots.length,
      lowStock.items.length,
      user.role === UserRole.ADMIN,
    );
  }

  getSalesTrend(
    query: SalesTrendQueryDto,
  ): Promise<DashboardSalesTrendResponseDto> {
    return this.dashboard.getSalesTrend(query);
  }

  getUnitsSold(
    query: UnitsSoldQueryDto,
  ): Promise<DashboardUnitsSoldResponseDto> {
    return this.dashboard.getUnitsSold(query);
  }

  getLowStock(query: LowStockQueryDto): Promise<DashboardLowStockResponseDto> {
    return this.dashboard.getLowStock(query);
  }

  getExpiring(query: ExpiringQueryDto): Promise<DashboardExpiringResponseDto> {
    return this.dashboard.getExpiring(query);
  }

  getRecentSales(
    query: RecentSalesQueryDto,
  ): Promise<DashboardRecentSalesResponseDto> {
    return this.dashboard.getRecentSales(query);
  }

  async getInitialStreamEvent(
    user: AuthenticatedUser,
  ): Promise<DashboardSseEvent> {
    const [kpis, recentSales] = await Promise.all([
      this.getKpis({}, user),
      user.role === UserRole.ADMIN
        ? this.getRecentSales({})
        : Promise.resolve({ generatedAt: new Date(), sales: [] }),
    ]);

    return {
      type: 'alert.triggered',
      data: {
        kind: 'snapshot',
        kpis,
        ...(user.role === UserRole.ADMIN ? { recentSales } : {}),
      },
    };
  }

  get events() {
    return this.eventBus.events.asObservable();
  }

  eventsFor(user: AuthenticatedUser) {
    return this.events.pipe(
      map((event) =>
        user.role === UserRole.ADMIN || event.type !== 'sale.created'
          ? event
          : { ...event, data: { kind: 'sale.changed' } },
      ),
    );
  }
}
