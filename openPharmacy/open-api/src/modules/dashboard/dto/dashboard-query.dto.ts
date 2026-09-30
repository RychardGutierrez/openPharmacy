import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const IANA_TIMEZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/;

/**
 * Shared query parameters for all dashboard endpoints.
 *
 * Dates are inclusive local calendar days (`YYYY-MM-DD`) resolved in `timezone`.
 * Defaults to the current calendar day in the configured timezone.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive start date (YYYY-MM-DD). Defaults to today.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid YYYY-MM-DD date' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date (YYYY-MM-DD). Defaults to today.',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid YYYY-MM-DD date' })
  to?: string;

  @ApiPropertyOptional({
    description:
      'IANA timezone for date boundaries and display (e.g. America/Bogota).',
    example: 'America/Bogota',
  })
  @IsOptional()
  @Matches(IANA_TIMEZONE, {
    message: 'timezone must be a valid IANA identifier',
  })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Return sales totals grouped by cashier (admin only).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  groupByCashier?: boolean = false;
}

/**
 * Query parameters for the expiring inventory endpoint.
 */
export class ExpiringQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Expiry horizon in days. Defaults to 30.',
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  @Type(() => Number)
  horizonDays?: number = 30;

  @ApiPropertyOptional({ description: 'Maximum lots to return.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

/**
 * Query parameters for the recent sales endpoint.
 */
export class RecentSalesQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of recent sales to return. Defaults to 10.',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}

export class SalesTrendQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Aggregation interval. Defaults to hour for one day, otherwise day.',
    enum: ['hour', 'day'],
  })
  @IsOptional()
  @IsString()
  @Matches(/^(hour|day)$/)
  interval?: 'hour' | 'day';
}

/**
 * Query parameters for the low-stock endpoint.
 */
export class LowStockQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by product name (case-insensitive partial match).',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Maximum products to return.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

export class UnitsSoldQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Maximum products to return.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}
