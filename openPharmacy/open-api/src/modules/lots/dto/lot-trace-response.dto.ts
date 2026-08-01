import { Expose } from 'class-transformer';
import { MovementType } from '@prisma/client';

export class LotTraceProductDto {
  @Expose()
  id!: string;

  @Expose()
  dciName!: string;

  @Expose()
  commercialName!: string;

  @Expose()
  barcode?: string | null;

  @Expose()
  category!: string;
}

export class LotTraceMovementDto {
  @Expose()
  id!: string;

  @Expose()
  movementType!: MovementType;

  @Expose()
  quantity!: number;

  @Expose()
  reason?: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  userFullName!: string;
}

export class LotTraceSaleItemDto {
  @Expose()
  id!: string;

  @Expose()
  saleId!: string;

  @Expose()
  quantity!: number;

  @Expose()
  unitPrice!: number;

  @Expose()
  lineTotal!: number;

  @Expose()
  createdAt!: Date;
}

export class LotTraceResponseDto {
  @Expose()
  id!: string;

  @Expose()
  lotNumber!: string;

  @Expose()
  expiryDate!: Date;

  @Expose()
  initialQty!: number;

  @Expose()
  currentQty!: number;

  @Expose()
  product!: LotTraceProductDto;

  @Expose()
  movements!: LotTraceMovementDto[];

  @Expose()
  saleItems!: LotTraceSaleItemDto[];
}
