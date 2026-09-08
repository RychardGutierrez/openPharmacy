import { BadRequestException } from '@nestjs/common';

/**
 * Thrown when one or more `saleItemId` values in the request do not
 * belong to the supplied `saleId`. Detected before any state change.
 */
export class ReturnSaleItemMismatchException extends BadRequestException {
  constructor(saleItemId: string, saleId: string) {
    super({
      statusCode: 400,
      code: 'RETURN_SALE_ITEM_MISMATCH',
      message: `Sale item ${saleItemId} does not belong to sale ${saleId}`,
    });
  }
}
