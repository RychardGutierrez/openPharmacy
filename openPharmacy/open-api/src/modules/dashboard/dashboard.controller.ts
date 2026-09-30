import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Observable, from, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DashboardService } from './dashboard.service';
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
  DashboardSalesTrendResponseDto,
  DashboardUnitsSoldResponseDto,
  KpiSummaryDto,
} from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CASHIER)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPI aggregates' })
  @ApiResponse({ status: 200, type: KpiSummaryDto })
  getKpis(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<KpiSummaryDto> {
    return this.dashboard.getKpis(query, user);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'List products at or below minimum stock' })
  @ApiResponse({ status: 200, type: DashboardLowStockResponseDto })
  getLowStock(
    @Query() query: LowStockQueryDto,
  ): Promise<DashboardLowStockResponseDto> {
    return this.dashboard.getLowStock(query);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'List lots expiring within the selected horizon' })
  @ApiResponse({ status: 200, type: DashboardExpiringResponseDto })
  getExpiring(
    @Query() query: ExpiringQueryDto,
  ): Promise<DashboardExpiringResponseDto> {
    return this.dashboard.getExpiring(query);
  }

  @Get('recent-sales')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent completed sales' })
  @ApiResponse({ status: 200, type: DashboardRecentSalesResponseDto })
  getRecentSales(
    @Query() query: RecentSalesQueryDto,
  ): Promise<DashboardRecentSalesResponseDto> {
    return this.dashboard.getRecentSales(query);
  }

  @Get('sales-trend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get hourly or daily sales trend' })
  @ApiResponse({ status: 200, type: DashboardSalesTrendResponseDto })
  getSalesTrend(
    @Query() query: SalesTrendQueryDto,
  ): Promise<DashboardSalesTrendResponseDto> {
    return this.dashboard.getSalesTrend(query);
  }

  @Get('units-sold')
  @ApiOperation({ summary: 'List products by units sold' })
  @ApiResponse({ status: 200, type: DashboardUnitsSoldResponseDto })
  getUnitsSold(
    @Query() query: UnitsSoldQueryDto,
  ): Promise<DashboardUnitsSoldResponseDto> {
    return this.dashboard.getUnitsSold(query);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Stream dashboard sale and alert events' })
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    const initial = from(this.dashboard.getInitialStreamEvent(user));
    const live = this.dashboard.eventsFor(user);

    return merge(initial, live).pipe(
      map((event) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      })),
    );
  }
}
