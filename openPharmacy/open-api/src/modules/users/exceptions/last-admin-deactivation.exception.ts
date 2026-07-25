import { ConflictException } from '@nestjs/common';

/**
 * Thrown when an admin tries to deactivate the last active ADMIN account.
 *
 * Returns HTTP 409 with a stable code so the frontend can show a specific
 * message.
 */
export class LastAdminDeactivationException extends ConflictException {
  constructor() {
    super({
      statusCode: 409,
      code: 'LAST_ADMIN',
      message: 'Cannot deactivate the last active admin account',
    });
  }
}
