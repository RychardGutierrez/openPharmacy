import { ConflictException } from '@nestjs/common';

export class DuplicateLotNumberException extends ConflictException {
  constructor(productId: string, lotNumber: string) {
    super({
      statusCode: 409,
      code: 'DUPLICATE_LOT_NUMBER',
      field: 'lotNumber',
      message: `Lot number "${lotNumber}" already exists for product ${productId}`,
    });
  }
}
