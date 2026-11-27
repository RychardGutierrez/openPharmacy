import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProductCategory } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  dciName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  commercialName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  laboratory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  form?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  concentration?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(14)
  @Matches(/^\d+$/, { message: 'barcode must contain only digits' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  barcode!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  salePrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minSalePrice!: number;

  @IsInt()
  @Min(0)
  @Max(999999)
  @Type(() => Number)
  minStock!: number;

  /**
   * SIN homologation codes (SIAT-08). Optional, but a product either has all three or none. The
   * codes are checked against the synced SIN catalogs in the service.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'sinActivityCode must contain only digits' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sinActivityCode?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'sinProductCode must contain only digits' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sinProductCode?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'sinUnitCode must contain only digits' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sinUnitCode?: string | null;
}
