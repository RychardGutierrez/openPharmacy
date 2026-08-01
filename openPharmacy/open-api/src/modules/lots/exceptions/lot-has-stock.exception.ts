import { ConflictException } from '@nestjs/common';

export class LotHasStockException extends ConflictException {
  constructor(id: string) {
    super({
      statusCode: 409,
      code: 'LOT_HAS_STOCK',
      message: `Lot ${id} still has stock and cannot be voided`,
    });
  }
}
