import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductPriceDto {
  @ApiProperty({ description: 'New sale price in BOB' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  @Type(() => Number)
  salePrice!: number;

  @ApiProperty({ description: 'Reason for the price change (audit)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
