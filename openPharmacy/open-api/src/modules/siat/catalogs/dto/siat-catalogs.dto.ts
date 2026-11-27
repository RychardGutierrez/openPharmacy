import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Query of `GET /siat/catalogs/:catalog`. */
export class ListSiatCatalogQuery {
  @ApiPropertyOptional({
    description: 'Parent code, for example the activity of a legend',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentCode?: string;

  @ApiPropertyOptional({
    description: 'Matches the code prefix or the description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Include codes that left the SIN list' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

/** Body of `POST /siat/catalogs/sync`. Omit `catalog` for a full sync. */
export class SyncSiatCatalogsDto {
  @ApiPropertyOptional({ example: 'document-types' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  catalog?: string;
}
