import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({ example: 250 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCash!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'SIAT point of sale for this shift. Optional when only one is active; required to choose among several while SIAT is enabled',
  })
  @IsOptional()
  @IsUUID()
  pointOfSaleId?: string;
}
