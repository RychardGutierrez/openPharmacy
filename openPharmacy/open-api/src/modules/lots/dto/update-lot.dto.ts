import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLotDto {
  @ApiPropertyOptional({ description: 'Corrected lot / batch number' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Corrected expiry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'expiryDate must be a valid date string (YYYY-MM-DD)' },
  )
  expiryDate?: string;

  @ApiProperty({ description: 'Reason for the correction' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason!: string;
}
