import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLotDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Manufacturer lot / batch number' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lotNumber!: string;

  @ApiProperty({ description: 'Expiry date (YYYY-MM-DD)' })
  @IsDateString(
    {},
    { message: 'expiryDate must be a valid date string (YYYY-MM-DD)' },
  )
  expiryDate!: string;

  @ApiProperty({
    description: 'Initial quantity received in this lot (must be positive)',
  })
  @IsInt()
  @Min(1)
  @Max(999999)
  @Type(() => Number)
  initialQty!: number;

  @ApiProperty({
    description: 'Unit cost actually paid for this specific lot, in BOB',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  unitCost!: number;
}
