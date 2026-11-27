import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { ProductCategory } from '@prisma/client';

const SIN_CODE = /^\d{1,20}$/;

/**
 * Assigns one set of SIN codes to a selection of products, or to a whole category (SIAT-08).
 * Either `productIds` or `category` is required (checked in the service).
 */
export class BulkAssignSinDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  productIds?: string[];

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @Matches(SIN_CODE, { message: 'sinActivityCode must contain only digits' })
  sinActivityCode!: string;

  @Matches(SIN_CODE, { message: 'sinProductCode must contain only digits' })
  sinProductCode!: string;

  @Matches(SIN_CODE, { message: 'sinUnitCode must contain only digits' })
  sinUnitCode!: string;

  /** Replace codes that are already complete. Off by default. */
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

/** Category default codes (SIAT-08). The same three codes, set on a category. */
export class SetCategoryDefaultDto {
  @Matches(SIN_CODE, { message: 'sinActivityCode must contain only digits' })
  sinActivityCode!: string;

  @Matches(SIN_CODE, { message: 'sinProductCode must contain only digits' })
  sinProductCode!: string;

  @Matches(SIN_CODE, { message: 'sinUnitCode must contain only digits' })
  sinUnitCode!: string;
}
