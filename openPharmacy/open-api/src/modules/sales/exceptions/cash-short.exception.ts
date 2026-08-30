import { BadRequestException } from '@nestjs/common';

export class CashShortException extends BadRequestException {
  constructor() {
    super({
      statusCode: 400,
      code: 'CASH_RECEIVED_BELOW_TOTAL',
      message: 'Cash received cannot be below the sale total',
    });
  }
}
