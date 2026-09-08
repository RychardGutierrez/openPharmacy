import { ReturnType } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /api/sales/:id/cancel`.
 */
export class CancelSaleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/**
 * Returned view of a `Return` row including its line items.
 *
 * Returned by `POST /api/returns`. Items reference the original
 * `saleItemId` they are reversing, the exact lot that stock was restored
 * to, the refunded quantity, and the product that was affected.
 */
export class ReturnResponseItemDto {
  id!: string;
  saleItemId!: string;
  productId!: string;
  lotId!: string;
  lotNumber!: string;
  quantity!: number;
}

export class ReturnResponseDto {
  id!: string;
  saleId!: string;
  userId!: string;
  reason!: string;
  returnType!: ReturnType;
  createdAt!: Date;
  items!: ReturnResponseItemDto[];
}
