import { IsDefined } from 'class-validator';

export class UpdateConfigDto {
  @IsDefined()
  value!: unknown;
}
