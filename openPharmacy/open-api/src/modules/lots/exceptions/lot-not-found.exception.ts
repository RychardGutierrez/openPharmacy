import { NotFoundException } from '@nestjs/common';

export class LotNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({
      statusCode: 404,
      code: 'LOT_NOT_FOUND',
      message: `Lot ${id} not found`,
    });
  }
}
