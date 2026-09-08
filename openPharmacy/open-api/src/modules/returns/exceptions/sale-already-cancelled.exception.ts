import { ConflictException } from '@nestjs/common';

/**
 * Thrown when `POST /api/sales/:id/cancel` targets a sale whose status is
 * not `COMPLETED` (already cancelled or refunded).
 */
export class SaleAlreadyCancelledException extends ConflictException {
  constructor(saleId: string, status: string) {
    super({
      statusCode: 409,
      code: 'SALE_ALREADY_CANCELLED',
      message: `Sale ${saleId} cannot be cancelled (current status: ${status})`,
    });
  }
}
