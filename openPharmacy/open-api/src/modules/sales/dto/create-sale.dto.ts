import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** Electronic method used for the non-cash leg of a MIXED payment. */
export const MIXED_SECONDARY_METHODS = [
  PaymentMethod.CARD,
  PaymentMethod.QR,
  PaymentMethod.TRANSFER,
] as const;

export class CreateSaleItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'secondaryMethod must be CARD, QR or TRANSFER',
  })
  secondaryMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  cashReceived?: number;

  /** Product ids with a missing prescription are accepted but audited for now. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  prescriptionProductIds?: string[];
}
