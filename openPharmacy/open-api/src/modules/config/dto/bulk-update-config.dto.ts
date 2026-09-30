import { IsObject } from 'class-validator';

export class BulkUpdateConfigDto {
  @IsObject()
  values!: Record<string, unknown>;
}
