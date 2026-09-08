import { ConflictException } from '@nestjs/common';

/**
 * Thrown when a return targets a sale that is not in a state that allows
 * it (e.g. missing, soft-deleted, cancelled, refunded, or already covered
 * by a return).
 */
export class ReturnSaleNotEligibleException extends ConflictException {
  constructor(saleId: string, status: string) {
    super({
      statusCode: 409,
      code: 'RETURN_SALE_NOT_ELIGIBLE',
      message: `Sale ${saleId} cannot be returned (current status: ${status})`,
    });
  }
}
