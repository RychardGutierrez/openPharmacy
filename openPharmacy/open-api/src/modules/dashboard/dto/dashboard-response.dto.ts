import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CashierTotalDto {
  @ApiProperty({ description: 'Cashier user id' })
  @Expose()
  userId!: string;

  @ApiProperty({ description: 'Cashier full name' })
  @Expose()
  fullName!: string;

  @ApiProperty({ description: 'Number of transactions' })
  @Expose()
  transactions!: number;

  @ApiProperty({ description: 'Net sales total' })
  @Expose()
  totalSales!: number;
}

export class KpiSummaryDto {
  @ApiProperty({ description: 'Whether sales-specific fields are available' })
  @Expose()
  salesVisible!: boolean;

  @ApiProperty({ description: 'Period start in UTC' })
  @Expose()
  startAt!: Date;

  @ApiProperty({ description: 'Period end in UTC' })
  @Expose()
  endAt!: Date;

  @ApiProperty({ description: 'Total net sales in period' })
  @Expose()
  totalSales!: number | null;

  @ApiProperty({ description: 'Total completed transactions' })
  @Expose()
  transactions!: number | null;

  @ApiProperty({ description: 'Total units sold' })
  @Expose()
  unitsSold!: number;

  @ApiProperty({ description: 'Number of products below or at min_stock' })
  @Expose()
  lowStockCount!: number;

  @ApiProperty({ description: 'Number of lots expiring within horizon' })
  @Expose()
  expiringCount!: number;

  @ApiProperty({ description: 'Number of currently active alerts' })
  @Expose()
  activeAlerts!: number;

  @ApiProperty({
    description: 'Sales totals grouped by cashier when requested',
    type: [CashierTotalDto],
  })
  @Expose()
  @Type(() => CashierTotalDto)
  cashierTotals!: CashierTotalDto[];
}

export class SalesTrendPointDto {
  @ApiProperty({ description: 'Local date/time bucket label' })
  @Expose()
  bucket!: string;

  @ApiProperty({ description: 'Net sales in the bucket' })
  @Expose()
  totalSales!: number;

  @ApiProperty({ description: 'Completed transactions in the bucket' })
  @Expose()
  transactions!: number;
}

export class DashboardSalesTrendResponseDto {
  @ApiProperty()
  @Expose()
  generatedAt!: Date;

  @ApiProperty({ enum: ['hour', 'day'] })
  @Expose()
  interval!: 'hour' | 'day';

  @ApiProperty({ type: [SalesTrendPointDto] })
  @Expose()
  @Type(() => SalesTrendPointDto)
  points!: SalesTrendPointDto[];
}

export class UnitsSoldItemDto {
  @ApiProperty()
  @Expose()
  productId!: string;

  @ApiProperty()
  @Expose()
  productName!: string;

  @ApiProperty()
  @Expose()
  unitsSold!: number;
}

export class DashboardUnitsSoldResponseDto {
  @ApiProperty()
  @Expose()
  generatedAt!: Date;

  @ApiProperty({ type: [UnitsSoldItemDto] })
  @Expose()
  @Type(() => UnitsSoldItemDto)
  items!: UnitsSoldItemDto[];
}

export class LowStockItemDto {
  @ApiProperty()
  @Expose()
  productId!: string;

  @ApiProperty()
  @Expose()
  commercialName!: string;

  @ApiProperty()
  @Expose()
  dciName!: string;

  @ApiProperty()
  @Expose()
  category!: string;

  @ApiProperty()
  @Expose()
  minStock!: number;

  @ApiProperty()
  @Expose()
  currentStock!: number;

  @ApiProperty({ description: 'Difference from minimum stock' })
  @Expose()
  deficit!: number;
}

export class ExpiringLotDto {
  @ApiProperty()
  @Expose()
  lotId!: string;

  @ApiProperty()
  @Expose()
  productId!: string;

  @ApiProperty()
  @Expose()
  productName!: string;

  @ApiProperty()
  @Expose()
  lotNumber!: string;

  @ApiProperty()
  @Expose()
  expiryDate!: Date;

  @ApiProperty()
  @Expose()
  currentQty!: number;

  @ApiProperty()
  @Expose()
  daysUntilExpiry!: number;

  @ApiProperty({ enum: ['RED', 'ORANGE', 'GREEN'] })
  @Expose()
  status!: 'RED' | 'ORANGE' | 'GREEN';
}

export class RecentSaleDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  receiptNumber!: string;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  cashier!: string;

  @ApiProperty()
  @Expose()
  paymentMethod!: string;

  @ApiProperty()
  @Expose()
  itemCount!: number;

  @ApiProperty()
  @Expose()
  total!: number;
}

export class DashboardLowStockResponseDto {
  @ApiProperty()
  @Expose()
  generatedAt!: Date;

  @ApiProperty({ type: [LowStockItemDto] })
  @Expose()
  @Type(() => LowStockItemDto)
  items!: LowStockItemDto[];
}

export class DashboardExpiringResponseDto {
  @ApiProperty()
  @Expose()
  generatedAt!: Date;

  @ApiProperty({ type: [ExpiringLotDto] })
  @Expose()
  @Type(() => ExpiringLotDto)
  lots!: ExpiringLotDto[];
}

export class DashboardRecentSalesResponseDto {
  @ApiProperty()
  @Expose()
  generatedAt!: Date;

  @ApiProperty({ type: [RecentSaleDto] })
  @Expose()
  @Type(() => RecentSaleDto)
  sales!: RecentSaleDto[];
}
