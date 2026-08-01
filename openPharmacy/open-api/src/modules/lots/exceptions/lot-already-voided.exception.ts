import { ConflictException } from '@nestjs/common';

export class LotAlreadyVoidedException extends ConflictException {
  constructor(id: string) {
    super({
      statusCode: 409,
      code: 'LOT_ALREADY_VOIDED',
      message: `Lot ${id} is already voided`,
    });
  }
}
