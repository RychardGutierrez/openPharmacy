import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Quantity ordered', minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(999999)
  @Type(() => Number)
  qtyOrdered!: number;

  @ApiProperty({
    description: 'Unit cost agreed on the PO line',
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID('4')
  supplierId!: string;

  @ApiProperty({ description: 'Purchase order date (YYYY-MM-DD)' })
  @IsDateString(
    {},
    { message: 'orderDate must be a valid date string (YYYY-MM-DD)' },
  )
  orderDate!: string;

  @ApiProperty({
    description: 'Purchase order line items',
    type: [CreatePurchaseOrderItemDto],
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}
