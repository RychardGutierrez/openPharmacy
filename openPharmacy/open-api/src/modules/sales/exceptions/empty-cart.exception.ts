import { BadRequestException } from '@nestjs/common';

export class EmptyCartException extends BadRequestException {
  constructor() {
    super({
      statusCode: 400,
      code: 'EMPTY_CART',
      message: 'At least one sale item is required',
    });
  }
}
