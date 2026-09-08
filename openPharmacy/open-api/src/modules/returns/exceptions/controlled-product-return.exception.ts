import { ForbiddenException } from '@nestjs/common';

/**
 * Thrown when a return (or cancellation) request targets a product whose
 * category is PSYCHOTROPIC or NARCOTIC.
 *
 * Returns HTTP 403 with a stable `CONTROLLED_PRODUCT` code. Per regulation
 * the check happens at the API layer regardless of any frontend state.
 */
export class ControlledProductReturnException extends ForbiddenException {
  constructor(productId: string, productName?: string) {
    super({
      statusCode: 403,
      code: 'CONTROLLED_PRODUCT',
      message: `Controlled substance ${productName ?? productId} cannot be returned or cancelled through this endpoint`,
    });
  }
}
