import { ReturnSource, ReturnType } from '@prisma/client';

/**
 * A row in the returns / cancellations list.
 */
export class ReturnListItemDto {
  id!: string;
  saleId!: string;
  receiptNumber!: string;
  userName!: string;
  reason!: string;
  returnType!: ReturnType;
  source!: ReturnSource;
  createdAt!: Date;
  itemCount!: number;
  totalRefund!: number;
}

/**
 * Paginated response for `GET /api/returns`.
 */
export class ReturnListResponseDto {
  data!: ReturnListItemDto[];
  total!: number;
  page!: number;
  pageSize!: number;
  totalPages!: number;
}
