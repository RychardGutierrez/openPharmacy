import { Expose } from 'class-transformer';
import { ProductCategory } from '@prisma/client';

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
  costPrice!: number;

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
}
