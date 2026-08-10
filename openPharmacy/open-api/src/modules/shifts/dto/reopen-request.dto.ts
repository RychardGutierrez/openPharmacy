import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReopenRequestDto {
  @ApiProperty({ example: 'Closing count entered incorrectly' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
