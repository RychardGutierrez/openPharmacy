import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Partial update of the SIAT settings. Absent fields are left unchanged.
 * The NIT is not here: SIAT uses `PHARMACY_NIT`, edited in the general configuration.
 */
export class UpdateSiatSettingsDto {
  @ApiPropertyOptional({ description: 'Código de sistema assigned by the SIN' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  systemCode?: string;

  @ApiPropertyOptional({
    description:
      'Token delegado. Write-only: an empty string keeps the stored token.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  token?: string;

  @ApiPropertyOptional({ example: '2027-11-15', description: 'YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'tokenExpiresAt must use the YYYY-MM-DD format',
  })
  tokenExpiresAt?: string;

  @ApiPropertyOptional({ enum: [2], description: '2 = Computarizada en Línea' })
  @IsOptional()
  @IsIn([2])
  modality?: number;

  @ApiPropertyOptional({ description: 'Exactly as registered in the Padrón' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @ApiPropertyOptional({ description: 'Código de actividad económica' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultActivity?: string;

  @ApiPropertyOptional({ description: 'Master switch for SIAT invoicing' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailInvoices?: boolean;
}
