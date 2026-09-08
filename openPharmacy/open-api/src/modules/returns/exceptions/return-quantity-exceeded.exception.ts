import { BadRequestException } from '@nestjs/common';

/**
 * Thrown when a return request asks for more units than are still refundable
 * for a given sale item.
 *
 * `alreadyReturned` reflects prior `return_items` rows. The client error
 * message includes both numbers so the cashier can adjust the request.
 */
export class ReturnQuantityExceededException extends BadRequestException {
  constructor(
    saleItemId: string,
    requested: number,
    alreadyReturned: number,
    available: number,
  ) {
    super({
      statusCode: 400,
      code: 'RETURN_QUANTITY_EXCEEDED',
      message: `Return quantity ${requested} for saleItem ${saleItemId} exceeds remaining refundable stock (${available}; already returned ${alreadyReturned})`,
    });
  }
}
