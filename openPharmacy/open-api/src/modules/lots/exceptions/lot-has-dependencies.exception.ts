import { ConflictException } from '@nestjs/common';

export class LotHasDependenciesException extends ConflictException {
  constructor(id: string) {
    super({
      statusCode: 409,
      code: 'LOT_HAS_DEPENDENCIES',
      message: `Lot ${id} has inventory movements, sales, or returns and cannot be edited or voided`,
    });
  }
}
