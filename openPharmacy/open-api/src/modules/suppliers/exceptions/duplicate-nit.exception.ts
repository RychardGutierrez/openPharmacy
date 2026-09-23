import { ConflictException } from '@nestjs/common';

/**
 * Thrown when a supplier is created or updated with a NIT that is already
 * registered to another supplier.
 *
 * Returns HTTP 409 with a stable code so the frontend can highlight the NIT
 * field and show a specific message.
 */
export class DuplicateNitException extends ConflictException {
  constructor(nit: string) {
    super({
      statusCode: 409,
      code: 'DUPLICATE_NIT',
      field: 'nit',
      message: `NIT "${nit}" is already registered to another supplier`,
    });
  }
}
