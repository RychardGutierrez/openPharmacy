import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AdjustmentStatus } from '@prisma/client';

export class AdjustmentsListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by lot UUID' })
  @IsOptional()
  @IsUUID('4')
  lotId?: string;

  @ApiPropertyOptional({
    enum: AdjustmentStatus,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsEnum(AdjustmentStatus)
  status?: AdjustmentStatus;

  @ApiPropertyOptional({ description: 'Filter by requester UUID' })
  @IsOptional()
  @IsUUID('4')
  requestedBy?: string;

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
