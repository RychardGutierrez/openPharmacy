import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier legal name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Supplier tax id (NIT)' })
  @IsString()
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
