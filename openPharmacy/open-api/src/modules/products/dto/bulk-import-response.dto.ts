import { CreateProductDto } from './create-product.dto';

/**
 * CSV row validation shape. Currently identical to `CreateProductDto`; it is
 * aliased so future row-level differences (e.g., optional columns, defaults) can
 * be introduced without changing the public API contract.
 */
export class BulkImportRowDto extends CreateProductDto {}

export class BulkImportFailedRowDto {
  row!: number;
  barcode!: string;
  errors!: string[];
}

export class BulkImportResponseDto {
  inserted!: number;
  failed!: BulkImportFailedRowDto[];
}
