import { Expose } from 'class-transformer';

export class PriceHistoryEntryDto {
  @Expose()
  id!: string;

  @Expose()
  productId!: string;

  @Expose()
  oldSalePrice?: number | null;

  @Expose()
  newSalePrice!: number;

  @Expose()
  reason?: string | null;

  @Expose()
  changedBy?: string | null;

  @Expose()
  changedByName?: string | null;

  @Expose()
  createdAt!: Date;
}
