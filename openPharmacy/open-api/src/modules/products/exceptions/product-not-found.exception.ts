import { NotFoundException } from '@nestjs/common';

/**
 * Thrown when a requested product does not exist or has been soft-deleted.
 */
export class ProductNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({
      statusCode: 404,
      code: 'PRODUCT_NOT_FOUND',
      message: `Product ${id} not found`,
    });
  }
}
