import { ConflictException } from '@nestjs/common';

export class LotNotEditableException extends ConflictException {
  constructor(id: string, reason: string) {
    super({
      statusCode: 409,
      code: 'LOT_NOT_EDITABLE',
      message: `Lot ${id} is not editable: ${reason}`,
    });
  }
}
