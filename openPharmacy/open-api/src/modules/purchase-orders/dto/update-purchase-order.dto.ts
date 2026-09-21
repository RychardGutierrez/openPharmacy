import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Existing order item UUID' })
  @IsUUID('4')
  orderItemId!: string;

  @ApiProperty({ description: 'Product UUID', minimum: 1 })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Quantity ordered', minimum: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  qtyOrdered!: number;

  @ApiProperty({ description: 'Unit cost agreed on the PO line', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  unitCost!: number;
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Supplier UUID' })
  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Purchase order date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'orderDate must be a valid date string (YYYY-MM-DD)' },
  )
  orderDate?: string;

  @ApiPropertyOptional({ description: 'Free-text reason for the update' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;

  @ApiProperty({
    description: 'Replace the order items with this list',
    type: [UpdatePurchaseOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderItemDto)
  items!: UpdatePurchaseOrderItemDto[];
}
