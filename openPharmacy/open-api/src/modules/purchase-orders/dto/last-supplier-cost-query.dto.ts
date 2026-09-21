import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsUUID } from 'class-validator';

export class LastSupplierCostQueryDto {
  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID('4')
  @Type(() => String)
  supplierId!: string;

  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  @Type(() => String)
  productId!: string;
}
