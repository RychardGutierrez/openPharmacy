import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AdjustmentDirection {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Lot UUID' })
  @IsUUID('4')
  lotId!: string;

  @ApiProperty({ description: 'Positive quantity to adjust' })
  @IsInt()
  @Min(1)
  @Max(999999)
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({
    enum: AdjustmentDirection,
    description: 'INCREASE or DECREASE',
  })
  @IsEnum(AdjustmentDirection)
  direction!: AdjustmentDirection;

  @ApiProperty({ description: 'Reason for the adjustment (min 20 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(500)
  reason!: string;
}
