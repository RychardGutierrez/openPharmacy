import { ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType, ProductCategory, ReportType } from '@prisma/client';
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

export enum ReportGroupBy {
  PRODUCT = 'PRODUCT',
  CASHIER = 'CASHIER',
}

export enum ReportView {
  RETURNS = 'RETURNS',
  ADJUSTMENTS = 'ADJUSTMENTS',
}

/** Filters and pagination for the lightweight live-preview endpoint. */
export class PreviewReportDto {
  @ApiPropertyOptional({ enum: ReportType })
  @IsEnum(ReportType)
  reportType!: ReportType;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid YYYY-MM-DD date' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid YYYY-MM-DD date' })
  to?: string;

  @ApiPropertyOptional({ example: 'America/La_Paz' })
  @IsOptional()
  @Matches(/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/)
  timezone?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ default: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  @Type(() => Number)
  horizonDays?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;
}
