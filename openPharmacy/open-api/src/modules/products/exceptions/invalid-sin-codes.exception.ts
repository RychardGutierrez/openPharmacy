import { UnprocessableEntityException } from '@nestjs/common';

export interface SinCodeFailure {
  field: 'sinActivityCode' | 'sinProductCode' | 'sinUnitCode';
  code: string;
}

/** A SIN code is not an active code of its catalog (SIAT-08). */
export class InvalidSinCodesException extends UnprocessableEntityException {
  constructor(failures: SinCodeFailure[]) {
    super({
      statusCode: 422,
      code: 'INVALID_SIN_CODES',
      message:
        'Some SIN codes are not active in the synced SIN catalogs, or the product does not belong to the activity',
      failures,
    });
  }
}

/** Only some of the three SIN codes were sent. A product needs all three or none (SIAT-08). */
export class IncompleteSinCodesException extends UnprocessableEntityException {
  constructor(missing: SinCodeFailure['field'][]) {
    super({
      statusCode: 422,
      code: 'INCOMPLETE_SIN_CODES',
      message: 'SIN codes must be sent together: activity, product and unit',
      missing,
    });
  }
}
