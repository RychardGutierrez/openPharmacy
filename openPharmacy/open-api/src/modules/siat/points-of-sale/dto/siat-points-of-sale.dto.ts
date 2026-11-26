import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** A branch exactly as registered in the SIN Padrón (casa matriz = 0). */
export class CreateSiatBranchDto {
  @ApiProperty({
    example: 0,
    description: 'codigoSucursal from the Padrón. 0 = casa matriz',
  })
  @IsInt()
  @Min(0)
  codigoSucursal!: number;

  @ApiProperty({ example: 'Casa Matriz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Address exactly as in the Padrón' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: 'La Paz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  municipality!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

/** `codigoSucursal` is fixed once created: it identifies the branch in every SIAT request. */
export class UpdateSiatBranchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  municipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RegisterSiatPointOfSaleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({
    example: 5,
    description:
      'codigoTipoPuntoVenta (provisional list until SIAT-07 syncs the catalog)',
  })
  @IsInt()
  codigoTipoPuntoVenta!: number;

  @ApiProperty({ example: 'Caja 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Caja principal del mostrador' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;
}

export class UpdateSiatPointOfSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'false retires the point of sale: no new shifts and no CUIS renewal. Required before closing it.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class EnsureSiatCuisDto {
  @ApiPropertyOptional({
    description:
      'Ask SIAT even outside the renewal window (SIAT answers "CUIS vigente" if still valid)',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class CloseSiatPointOfSaleDto {
  @ApiProperty({
    enum: [true],
    description:
      'Closing is final: the SIN never reuses the point-of-sale number',
  })
  @Equals(true, {
    message: 'confirm must be true: closing a point of sale is final',
  })
  confirm!: true;
}

export class ReconcileSiatPointsOfSaleQuery {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;
}
