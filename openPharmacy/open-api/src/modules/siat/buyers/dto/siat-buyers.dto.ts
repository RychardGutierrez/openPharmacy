import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Format checks only. The buyer rules (S/N, Bs 1,000, complemento, codigoExcepcion, special
 * codes) live in `siat-buyer-rules.ts`, so they apply to every caller, not just HTTP.
 */

/** Body of `POST /siat/buyers/verify-nit`. */
export class VerifyNitDto {
  @ApiProperty({ example: '1020304022', description: 'Buyer NIT, digits only' })
  @IsString()
  @Matches(/^\s*\d{1,20}\s*$/, { message: 'nit must be 1 to 20 digits' })
  nit!: string;
}

export class BuyerDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'SIN document type: 1 CI, 2 CEX, 3 PAS, 4 OD, 5 NIT',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  docType?: number;

  @ApiPropertyOptional({ example: '1020304022' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  docNumber?: string;

  @ApiPropertyOptional({ example: '1A', description: 'CI only' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  complement?: string;

  @ApiPropertyOptional({ example: 'Farmacias Andinas SRL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @ApiPropertyOptional({ example: 'cliente@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ description: 'Defaults to the document number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigoCliente?: string;
}

/** Body of `POST /siat/buyers/resolve`. */
export class ResolveBuyerDto {
  @ApiPropertyOptional({
    type: BuyerDto,
    description: 'Omit for an anonymous (S/N) buyer',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BuyerDto)
  buyer?: BuyerDto;

  @ApiProperty({ example: 150.5, description: 'Invoice total in bolivianos' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;

  @ApiPropertyOptional({
    description:
      'Explicit cashier confirmation to issue to a NIT that SIAT reported invalid (codigoExcepcion = 1)',
  })
  @IsOptional()
  @IsBoolean()
  confirmInvalidNit?: boolean;
}

/** Query of `GET /siat/buyers/customers`. */
export class SearchCustomersQuery {
  @ApiProperty({ example: '10203', description: 'Document number prefix' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  docNumber!: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  docType?: number;
}
