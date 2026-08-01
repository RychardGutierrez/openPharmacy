import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DeductStockDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Quantity to deduct' })
  @IsInt()
  @Min(1)
  @Max(999999)
  @Type(() => Number)
  quantity!: number;
}
