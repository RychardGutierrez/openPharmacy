import { ReturnType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Body for `POST /api/returns`.
 *
 * - `saleId` identifies the original sale being reversed.
 * - `reason` is a free-text note captured on the return record and in the
 *   audit log.
 * - `returnType` matches the `ReturnType` enum (FULL or PARTIAL).
 * - `items[]` carries the per-line information. Each item only needs the
 *   `saleItemId` and the quantity to refund; the lot is recovered server
 *   side from the original `sale_items.lot_id` so a client cannot tamper
 *   with it.
 */
export class CreateReturnItemDto {
  @IsUUID()
  saleItemId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

export class CreateReturnDto {
  @IsUUID()
  saleId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsEnum(ReturnType)
  returnType!: ReturnType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items!: CreateReturnItemDto[];
}
