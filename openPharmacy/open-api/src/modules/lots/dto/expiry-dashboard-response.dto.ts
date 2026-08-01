import { Expose } from 'class-transformer';
import type { ExpiryStatus } from '../events/lot-expiry-alert.event';

export class ExpiryDashboardLotDto {
  @Expose()
  id!: string;

  @Expose()
  productId!: string;

  @Expose()
  productName!: string;

  @Expose()
  lotNumber!: string;

  @Expose()
  expiryDate!: Date;

  @Expose()
  currentQty!: number;

  @Expose()
  status!: ExpiryStatus;

  @Expose()
  daysUntilExpiry!: number;
}

export class ExpiryDashboardStatusGroupDto {
  @Expose()
  status!: ExpiryStatus;

  @Expose()
  count!: number;

  @Expose()
  lots!: ExpiryDashboardLotDto[];
}

export class ExpiryDashboardResponseDto {
  @Expose()
  generatedAt!: Date;

  @Expose()
  red!: ExpiryDashboardStatusGroupDto;

  @Expose()
  orange!: ExpiryDashboardStatusGroupDto;

  @Expose()
  green!: ExpiryDashboardStatusGroupDto;
}
