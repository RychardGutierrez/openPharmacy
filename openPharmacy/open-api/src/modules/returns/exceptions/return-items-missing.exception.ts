import { BadRequestException } from '@nestjs/common';

/**
 * Thrown when a return request is received but no matching sale items can
 * be resolved for the supplied `saleItemId`s.
 */
export class ReturnItemsMissingException extends BadRequestException {
  constructor(missingIds: string[]) {
    super({
      statusCode: 400,
      code: 'RETURN_ITEMS_MISSING',
      message: `One or more sale items were not found: ${missingIds.join(', ')}`,
    });
  }
}
