import { Expose } from 'class-transformer';

export class MarginAlertDto {
  @Expose()
  previousUnitCost!: number | null;

  @Expose()
  newUnitCost!: number;

  @Expose()
  increasePct!: number | null;

  @Expose()
  currentSalePrice!: number;

  @Expose()
  currentMarginPct!: number;

  @Expose()
  suggestedSalePrice!: number | null;
}

export class LotResponseDto {
  @Expose()
  id!: string;

  @Expose()
  productId!: string;

  @Expose()
  lotNumber!: string;

  @Expose()
  expiryDate!: Date;

  @Expose()
  initialQty!: number;

  @Expose()
  currentQty!: number;

  @Expose()
  unitCost!: number;

  @Expose()
  voidedAt?: Date | null;

  @Expose()
  voidReason?: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  product?: { id: string; dciName: string; commercialName: string } | null;

  @Expose()
  marginAlert?: MarginAlertDto | null;
}
