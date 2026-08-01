import { Expose } from 'class-transformer';

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
  voidedAt?: Date | null;

  @Expose()
  voidReason?: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  product?: { id: string; dciName: string; commercialName: string } | null;
}
