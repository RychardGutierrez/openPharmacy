import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Strip every non-digit character and surrounding whitespace so the NIT is
 * always persisted in a canonical, digits-only form. Accepts input such as
 * `"123-456-789"`, `" 900123456 "` or `"NIT 900-1"` and reduces it to the bare
 * number.
 */
export const normalizeNit = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\D+/g, '') : '';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier legal name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description:
      'Supplier tax id (NIT). Digits only; non-numeric input is stripped.',
    example: '900123456',
  })
  @Transform(({ value }) => normalizeNit(value))
  @IsString()
  @IsNotEmpty({ message: 'nit is required' })
  @Matches(/^\d+$/, { message: 'nit must contain at least one digit' })
  @MaxLength(50)
  nit!: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ description: 'Sales contact full name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contact_person?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Sales email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Payment terms (e.g. Net 30)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  payment_terms?: string;

  @ApiPropertyOptional({ description: 'Whether the supplier is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SuppliersListQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, NIT, or contact' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  pageSize?: number = 50;
}
