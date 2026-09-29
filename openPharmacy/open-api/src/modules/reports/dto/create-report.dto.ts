import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MovementType,
  ProductCategory,
  ReportFormat,
  ReportType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ReportGroupBy, ReportView } from './preview-report.dto';

const IANA_TIMEZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/;

/**
 * Request body for `POST /api/reports`. Declares a report type, output format,
 * and the filters the export should apply. Date filters are inclusive local
 * calendar dates (`YYYY-MM-DD`); the service converts them to a half-open UTC
 * range using `timezone`.
 */
export class CreateReportDto {
  @ApiProperty({ enum: ReportType, description: 'Which report to generate' })
  @IsEnum(ReportType)
  reportType!: ReportType;

  @ApiProperty({ enum: ReportFormat, description: 'Output file format' })
  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @ApiPropertyOptional({
    description: 'Inclusive start date (YYYY-MM-DD). Defaults to last 30 days.',
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

  @ApiPropertyOptional({ description: 'Restrict to a single product (UUID)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Restrict to a single lot (UUID)' })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiPropertyOptional({
    enum: MovementType,
    description: 'Movement type filter',
  })
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({ enum: ReportGroupBy })
  @IsOptional()
  @IsEnum(ReportGroupBy)
  groupBy?: ReportGroupBy;

  @ApiPropertyOptional({ enum: ReportView })
  @IsOptional()
  @IsEnum(ReportView)
  view?: ReportView;

  @ApiPropertyOptional({ description: 'Restrict to a user/cashier (UUID)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Restrict purchases to a supplier (UUID)',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Expiry horizon in days for the EXPIRY report (default 90).',
    default: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  @Type(() => Number)
  horizonDays?: number;
}
