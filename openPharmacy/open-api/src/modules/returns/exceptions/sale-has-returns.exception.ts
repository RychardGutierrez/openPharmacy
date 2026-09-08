import { ConflictException } from '@nestjs/common';

/**
 * Thrown when `POST /api/sales/:id/cancel` is invoked but the sale already
 * has a return record. Cancelling a partially refunded sale would create
 * ambiguous inventory movements; the operator must resolve the return
 * first.
 */
export class SaleHasReturnsException extends ConflictException {
  constructor(saleId: string) {
    super({
      statusCode: 409,
      code: 'SALE_HAS_RETURNS',
      message: `Sale ${saleId} already has a return and cannot be cancelled`,
    });
  }
}
