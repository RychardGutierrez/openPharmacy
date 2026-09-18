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
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReceivePurchaseOrderItemDto {
  @ApiProperty({ description: 'Order item UUID being received' })
  @IsUUID('4')
  orderItemId!: string;

  @ApiProperty({ description: 'Quantity received in this line', minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(999999)
  @Type(() => Number)
  qtyReceived!: number;

  @ApiProperty({ description: 'Manufacturer lot / batch number' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lotNumber!: string;

  @ApiProperty({ description: 'Lot expiry date (YYYY-MM-DD)' })
  @IsDateString(
    {},
    { message: 'expiryDate must be a valid date string (YYYY-MM-DD)' },
  )
  expiryDate!: string;

  @ApiProperty({
    description: 'Actual unit cost paid for this lot',
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  unitCost!: number;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier invoice number' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  invoiceNumber!: string;

  @ApiProperty({ description: 'Supplier invoice date (YYYY-MM-DD)' })
  @IsDateString(
    {},
    { message: 'invoiceDate must be a valid date string (YYYY-MM-DD)' },
  )
  invoiceDate!: string;

  @ApiProperty({
    description: 'Receiving line items',
    type: [ReceivePurchaseOrderItemDto],
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items!: ReceivePurchaseOrderItemDto[];
}
