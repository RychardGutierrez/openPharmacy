import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CloseShiftDto {
  @ApiProperty({ example: 1840.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCash!: number;
}
