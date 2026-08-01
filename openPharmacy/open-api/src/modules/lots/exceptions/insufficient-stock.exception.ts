import { ConflictException } from '@nestjs/common';

export class InsufficientStockException extends ConflictException {
  constructor(productId: string, requested: number) {
    super({
      statusCode: 409,
      code: 'INSUFFICIENT_STOCK',
      message: `Insufficient active non-expired stock for product ${productId} (requested ${requested})`,
    });
  }
}
