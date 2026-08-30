import { ConflictException } from '@nestjs/common';

export class ProductInactiveException extends ConflictException {
  constructor(productId: string) {
    super({
      statusCode: 409,
      code: 'PRODUCT_INACTIVE',
      message: `Product ${productId} is inactive or missing`,
    });
  }
}
