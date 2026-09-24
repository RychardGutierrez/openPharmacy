import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MovementType } from '@prisma/client';

export class MovementsListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by lot UUID' })
  @IsOptional()
  @IsUUID('4')
  lotId?: string;

  @ApiPropertyOptional({
    enum: MovementType,
    description: 'Filter by movement type',
  })
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @ApiPropertyOptional({ description: 'Filter by user UUID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter movements created on or after this date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid date string (YYYY-MM-DD)' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter movements created on or before this date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid date string (YYYY-MM-DD)' })
  to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;
}
