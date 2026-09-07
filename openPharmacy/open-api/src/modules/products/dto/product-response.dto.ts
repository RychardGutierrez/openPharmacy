import { Expose, Type } from 'class-transformer';
import { ProductCategory } from '@prisma/client';

/** Aggregated, non-voided, non-expired lot info for POS grids. */
export class ProductStockSummaryDto {
  @Expose()
  availableQty!: number;

  @Expose()
  earliestExpiry!: Date | null;

  @Expose()
  daysUntilExpiry!: number | null;

  @Expose()
  expiringSoon!: boolean;
}

export class ProductResponseDto {
  @Expose()
  id!: string;

  @Expose()
  dciName!: string;

  @Expose()
  commercialName!: string;

  @Expose()
  laboratory?: string | null;

  @Expose()
  form?: string | null;

  @Expose()
  concentration?: string | null;

  @Expose()
  barcode!: string;

  @Expose()
  category!: ProductCategory;

  @Expose()
  salePrice!: number;

  @Expose()
  minSalePrice!: number;

  @Expose()
  minStock!: number;

  @Expose()
  active!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  deletedAt?: Date | null;

  @Expose()
  @Type(() => ProductStockSummaryDto)
  stockSummary?: ProductStockSummaryDto | null;
}
